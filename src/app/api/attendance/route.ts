import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionStatus, SESSION_SCHEDULES } from '@/lib/schedule';
import { v4 as uuidv4 } from 'uuid';
// ============================================
// RATE LIMITING (Simple In-Memory Store)
// ============================================
// Tracks requests by IP/identifier
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function getRateLimitKey(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return ip;
}

function checkRateLimit(key: string, maxLimit: number): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= maxLimit) {
    return false;
  }

  record.count++;
  return true;
}

// ============================================
// EMAIL VALIDATION
// ============================================
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidParticipantName(name: string): boolean {
  return /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name.trim());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, nama_peserta, role, nim_nip, Sesi, local_token } = body;

    // Rate limit berdasarkan IP (GPS & fingerprint perangkat dinonaktifkan)
    const ip = getRateLimitKey(req);
    const ipKey = `IP:${ip}`;

    if (!checkRateLimit(ipKey, 1000)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request dari jaringan ini. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      );
    }

    const isPanitiaRole = role === 'panitia_mahasiswa' || role === 'panitia_dosen';

    // 1. Basic Validation
    if (!email || (!isPanitiaRole && !nama_peserta) || !nim_nip || !Sesi) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isPanitiaRole && !isValidParticipantName(String(nama_peserta))) {
      return NextResponse.json({ error: 'Nama hanya boleh berisi huruf, spasi, tanda hubung, atau apostrof.' }, { status: 400 });
    }

    const allowedRoles = [
      // Acara ini hanya untuk peserta (role panitia dinonaktifkan)
      'peserta_tendik',
      'peserta_dosen',
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    // Validate NIM / NIP format
    const cleanNimNip = String(nim_nip).trim();
    const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';
    if (isDosenRole) {
      if (!/^\d{1,24}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIP harus berupa angka maksimal 24 digit.' }, { status: 400 });
      }
    } else {
      // Mahasiswa / Panitia Mahasiswa / Peserta Mahasiswa
      if (!/^\d{1,14}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIM tidak valid (maksimal 14 digit angka).' }, { status: 400 });
      }
    }

    // Whitelist validation untuk role Panitia
    let verifiedPanitiaName = nama_peserta;

    if (role === 'panitia_mahasiswa') {
      const { data: whitelistEntry, error: whitelistError } = await supabaseAdmin
        .from('Panitia Mahasiswa')
        .select('NIM, Nama')
        .eq('NIM', cleanNimNip)
        .maybeSingle();

      if (whitelistError) {
        console.error('Panitia Mahasiswa lookup error:', whitelistError);
        return NextResponse.json({ error: 'Gagal memvalidasi data Panitia Mahasiswa.' }, { status: 500 });
      }

      if (!whitelistEntry) {
        return NextResponse.json({
          error: 'NIM Anda tidak terdaftar sebagai Panitia Mahasiswa. Silakan pilih role yang sesuai.'
        }, { status: 403 });
      }

      verifiedPanitiaName = whitelistEntry.Nama;
    }

    if (role === 'panitia_dosen') {
      const { data: whitelistEntry, error: whitelistError } = await supabaseAdmin
        .from('Panitia Dosen')
        .select('NIP, Nama')
        .eq('NIP', cleanNimNip)
        .maybeSingle();

      if (whitelistError) {
        console.error('Panitia Dosen lookup error:', whitelistError);
        return NextResponse.json({ error: 'Gagal memvalidasi data Panitia Dosen.' }, { status: 500 });
      }

      if (!whitelistEntry) {
        return NextResponse.json({
          error: 'NIP Anda tidak terdaftar sebagai Panitia Dosen. Silakan pilih role yang sesuai.'
        }, { status: 403 });
      }

      verifiedPanitiaName = whitelistEntry.Nama;
    }

    // Validate Sesi value
    const sessionId = Number(Sesi) as 1 | 2;
    if (![1, 2].includes(sessionId)) {
      return NextResponse.json({ error: 'Sesi absensi tidak valid.' }, { status: 400 });
    }

    // Nama sesi untuk tampilan
    const sesiName = sessionId === 1 ? 'Pagi' : 'Siang';

    // Check Schedule Validation
    const scheduleStatus = getSessionStatus(sessionId);
    if (!scheduleStatus.isOpen) {
      const sessionConfig = SESSION_SCHEDULES[sessionId];
      return NextResponse.json({
        error: `Absensi Sesi ${sessionConfig.name} sedang ditutup (${scheduleStatus.message}).`
      }, { status: 400 });
    }

    // 2. Geofencing dinonaktifkan untuk acara ini.

    // 3. Anti-Cheat Validations are handled by Supabase UNIQUE INDEX constraint.

    // 4. Generate new token if not provided
    const newToken = local_token || uuidv4();

    // 5. Insert ke Database — kolom Sesi menyimpan "Pagi" atau "Siang"
    const { error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        email,
        nama_peserta: verifiedPanitiaName,
        role,
        nim_nip: cleanNimNip,
        Sesi: sesiName,
        local_token: newToken
      });

    // Helper untuk mengecek kelayakan sertifikat (Sesi Pagi selesai)
    // Mendukung 'Pagi', 'Pagi ( 08-00 -10.00 )', '1', atau record sebelum jam 10:00 WITA (02:00 UTC)
    // Serta mencocokkan via NIM ataupun Email fallback (mengatasi salah ketik NIM)
    const checkEligiblePagi = async (nim: string, emailStr?: string): Promise<boolean> => {
      const isPagiMatch = (r: { Sesi?: string; created_at?: string }) => {
        const s = String(r.Sesi || '').trim().toLowerCase();
        const isMorning = r.created_at && new Date(r.created_at).getTime() < new Date('2026-09-28T02:00:00Z').getTime();
        return s.startsWith('pagi') || s === '1' || isMorning;
      };

      if (nim) {
        const { data: nimRecords } = await supabaseAdmin
          .from('attendance')
          .select('id, Sesi, created_at')
          .eq('nim_nip', nim);

        if (nimRecords && nimRecords.some(isPagiMatch)) {
          return true;
        }
      }

      if (emailStr) {
        const { data: emailRecords } = await supabaseAdmin
          .from('attendance')
          .select('id, Sesi, created_at')
          .ilike('email', emailStr.trim().toLowerCase());

        if (emailRecords && emailRecords.some(isPagiMatch)) {
          return true;
        }
      }

      return false;
    };

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Penanganan khusus untuk error kode 23505 (Unique Violation / Race Condition)
      if (insertError.code === '23505') {
        // Ambil data existing dari database untuk mendapatkan role, nama_peserta, dan waktu absensi yang akurat
        const { data: existingRecord } = await supabaseAdmin
          .from('attendance')
          .select('role, nama_peserta, created_at')
          .eq('nim_nip', cleanNimNip)
          .eq('Sesi', sesiName)
          .limit(1);

        const existingRole = (existingRecord && existingRecord[0]?.role) || role;
        const existingNama = (existingRecord && existingRecord[0]?.nama_peserta) || verifiedPanitiaName;
        const existingWaktu = existingRecord && existingRecord[0]?.created_at
          ? new Date(existingRecord[0].created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
          : undefined;

        return NextResponse.json({ 
          error: `Sistem mendeteksi pengiriman ganda. Anda (atau perangkat Anda) sudah tercatat absen di Sesi ${sesiName}.`,
          already_attended: true,
          sesi: sesiName,
          nama_peserta: existingNama,
          role: existingRole,
          waktu: existingWaktu,
          eligibleForCertificate: true
        }, { status: 400 });
      }

      return NextResponse.json({ error: `Gagal menyimpan data absensi: ${insertError.message}` }, { status: 500 });
    }

    // 6. Cek Kelayakan Sertifikat: Asalkan sudah absensi di pagi atau siang hari, berhak atas sertifikat
    const eligibleForCertificate = true;

    return NextResponse.json({
      success: true,
      message: `Absensi Sesi ${sesiName} berhasil disimpan!`,
      local_token: newToken,
      nama_peserta: verifiedPanitiaName,
      role,
      eligibleForCertificate
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

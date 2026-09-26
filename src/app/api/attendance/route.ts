import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDistanceInMeters, EVENT_LATITUDE, EVENT_LONGITUDE, MAX_DISTANCE_METERS } from '@/lib/haversine';
import { getSessionStatus, SESSION_SCHEDULES } from '@/lib/schedule';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
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
    const { email, nama_peserta, role, nim_nip, Sesi, visitor_id, local_token, latitude, longitude, accuracy, timestamp, signature } = body;

    // Check rate limit (Kombinasi 2 Lapis: IP dan Visitor ID)
    const ip = getRateLimitKey(req);
    const ipKey = `IP:${ip}`;
    const fpKey = `FP:${visitor_id || 'unknown'}`;

    // Lapisan 1: Limit IP (sangat longgar — keamanan utama ada di Geofencing + Jadwal + Unique Index NIM)
    // 1.000/menit = akomodasi hingga 1.000 mahasiswa WiFi kampus yang berbagi 1 IP dalam 1 menit
    if (!checkRateLimit(ipKey, 1000)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request dari jaringan ini. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      );
    }

    // Lapisan 2: Limit Perangkat (ketat untuk mencegah spam visitor_id palsu)
    if (!checkRateLimit(fpKey, 10)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request dari perangkat ini. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      );
    }

    const isPanitiaRole = role === 'panitia_mahasiswa' || role === 'panitia_dosen';

    // 1. Basic Validation
    if (!email || (!isPanitiaRole && !nama_peserta) || !nim_nip || !Sesi || !visitor_id || latitude === undefined || longitude === undefined || accuracy === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1b. Anti-Replay Attack & Integrity Validation
    if (!timestamp || !signature) {
      return NextResponse.json({ error: 'Missing security parameters' }, { status: 400 });
    }

    const currentServerTime = Date.now();
    if (Math.abs(currentServerTime - timestamp) > 10000) { // Toleransi 10 detik
      return NextResponse.json({ error: 'Request kadaluarsa (terindikasi intercept)' }, { status: 403 });
    }

    const expectedMessage = `${latitude}|${longitude}|${accuracy}|${timestamp}|SECRET_SALT_2026`;
    const expectedSignature = crypto.createHash('sha256').update(expectedMessage).digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Data request dimanipulasi!' }, { status: 403 });
    }

    // Validation Fake GPS / Mock Location (< 1m accuracy) & Weak Accuracy (> 150m accuracy)
    const accuracyNumber = Number(accuracy);
    if (!Number.isFinite(accuracyNumber) || accuracyNumber < 1.0) {
      return NextResponse.json({ error: 'Terdeteksi lokasi tidak valid (Fake GPS / Mock Location). Harap gunakan GPS asli perangkat.' }, { status: 400 });
    }
    if (accuracyNumber > 150) {
      return NextResponse.json({ error: `Sinyal GPS kurang akurat (${Math.round(accuracyNumber)}m). Harap aktifkan High Accuracy GPS.` }, { status: 400 });
    }

    if (!isPanitiaRole && !isValidParticipantName(String(nama_peserta))) {
      return NextResponse.json({ error: 'Nama hanya boleh berisi huruf, spasi, tanda hubung, atau apostrof.' }, { status: 400 });
    }

    const allowedRoles = [
      'panitia_mahasiswa',
      'panitia_dosen',
      'peserta_mahasiswa',
      'peserta_tendik',
      'peserta_dosen',
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
    }

    const latitudeNumber = Number(latitude);
    const longitudeNumber = Number(longitude);
    if (
      !Number.isFinite(latitudeNumber) ||
      !Number.isFinite(longitudeNumber) ||
      latitudeNumber < -90 ||
      latitudeNumber > 90 ||
      longitudeNumber < -180 ||
      longitudeNumber > 180
    ) {
      return NextResponse.json({ error: 'Koordinat lokasi tidak valid.' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    // Validate NIM / NIP format
    const cleanNimNip = String(nim_nip).trim();
    const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';
    if (isDosenRole) {
      if (!/^\d{19}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIP harus berupa 19 digit angka.' }, { status: 400 });
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

    // 2. Geofencing Validation
    const distance = getDistanceInMeters(latitudeNumber, longitudeNumber, EVENT_LATITUDE, EVENT_LONGITUDE);
    if (distance > MAX_DISTANCE_METERS) {
      return NextResponse.json({
        error: `Lokasi Anda terlalu jauh dari lokasi acara (${Math.round(distance)} meter). Jarak maksimal adalah ${MAX_DISTANCE_METERS} meter.`
      }, { status: 400 });
    }

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
        nim_nip,
        Sesi: sesiName,
        visitor_id,
        local_token: newToken,
        latitude: latitudeNumber,
        longitude: longitudeNumber
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      
      // Penanganan khusus untuk error kode 23505 (Unique Violation / Race Condition)
      if (insertError.code === '23505') {
        return NextResponse.json({ 
          error: `Sistem mendeteksi pengiriman ganda. Anda (atau perangkat Anda) sudah tercatat absen di Sesi ${sesiName}.` 
        }, { status: 400 });
      }

      return NextResponse.json({ error: `Gagal menyimpan data absensi: ${insertError.message}` }, { status: 500 });
    }

    // 6. Cek Kelayakan Sertifikat (jika Sesi Siang, cek apakah sudah absen Pagi)
    let eligibleForCertificate = false;
    if (sessionId === 2) {
      const { data: pagiData } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('email', email)
        .eq('Sesi', 'Pagi')
        .maybeSingle();

      if (pagiData) {
        eligibleForCertificate = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Absensi Sesi ${sesiName} berhasil disimpan!`,
      local_token: newToken,
      nama_peserta: verifiedPanitiaName,
      eligibleForCertificate
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDistanceInMeters, EVENT_LATITUDE, EVENT_LONGITUDE, MAX_DISTANCE_METERS } from '@/lib/haversine';
import { getSessionStatus, SESSION_SCHEDULES } from '@/lib/schedule';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// RATE LIMITING (Simple In-Memory Store)
// ============================================
// Tracks requests by IP/identifier
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 requests per minute

function getRateLimitKey(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return ip;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
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

export async function POST(req: Request) {
  try {
    // Check rate limit
    const clientKey = getRateLimitKey(req);
    if (!checkRateLimit(clientKey)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, nama_peserta, role, nim_nip, Sesi, visitor_id, local_token, latitude, longitude } = body;

    // 1. Basic Validation
    if (!email || !nama_peserta || !nim_nip || !Sesi || !visitor_id || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    // Validate NIM / NIP format
    const cleanNimNip = String(nim_nip).trim();
    const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';
    if (isDosenRole) {
      if (!/^\d{18}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIP harus berupa 18 digit angka.' }, { status: 400 });
      }
    } else {
      // Mahasiswa / Panitia Mahasiswa / Peserta Mahasiswa
      if (!/^\d{10}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIM harus berupa 10 digit angka.' }, { status: 400 });
      }
    }

    // Whitelist validation untuk role Panitia
    if (role === 'panitia_mahasiswa') {
      const { data: whitelistEntry } = await supabaseAdmin
        .from('Panitia Mahasiswa')
        .select('nim')
        .eq('nim', cleanNimNip)
        .maybeSingle();

      if (!whitelistEntry) {
        return NextResponse.json({
          error: 'NIM Anda tidak terdaftar sebagai Panitia Mahasiswa. Silakan pilih role yang sesuai.'
        }, { status: 403 });
      }
    }

    if (role === 'panitia_dosen') {
      const { data: whitelistEntry } = await supabaseAdmin
        .from('Panitia Dosen')
        .select('nip')
        .eq('nip', cleanNimNip)
        .maybeSingle();

      if (!whitelistEntry) {
        return NextResponse.json({
          error: 'NIP Anda tidak terdaftar sebagai Panitia Dosen. Silakan pilih role yang sesuai.'
        }, { status: 403 });
      }
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
    const distance = getDistanceInMeters(latitude, longitude, EVENT_LATITUDE, EVENT_LONGITUDE);
    if (distance > MAX_DISTANCE_METERS) {
      return NextResponse.json({
        error: `Lokasi Anda terlalu jauh dari lokasi acara (${Math.round(distance)} meter). Jarak maksimal adalah ${MAX_DISTANCE_METERS} meter.`
      }, { status: 400 });
    }

    // 3. Anti-Cheat Validations
    // a. Cek apakah email sudah absen di sesi ini
    const { data: existingEntry } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('email', email)
      .eq('Sesi', sesiName)
      .maybeSingle();

    if (existingEntry) {
      return NextResponse.json({ error: `Anda sudah melakukan absensi untuk Sesi ${sesiName}.` }, { status: 400 });
    }

    // b. Cek apakah visitor_id sudah dipakai email lain di sesi ini
    const { data: fingerprintEntry } = await supabaseAdmin
      .from('attendance')
      .select('email')
      .eq('visitor_id', visitor_id)
      .eq('Sesi', sesiName)
      .neq('email', email)
      .limit(1)
      .maybeSingle();

    if (fingerprintEntry) {
      return NextResponse.json({ error: `Perangkat ini sudah digunakan untuk absen Sesi ${sesiName} dengan email lain.` }, { status: 400 });
    }

    // c. Cek apakah local_token sudah dipakai email lain di sesi ini
    if (local_token) {
      const { data: tokenEntry } = await supabaseAdmin
        .from('attendance')
        .select('email')
        .eq('local_token', local_token)
        .eq('Sesi', sesiName)
        .neq('email', email)
        .limit(1)
        .maybeSingle();

      if (tokenEntry) {
        return NextResponse.json({ error: `Browser ini sudah digunakan untuk absen Sesi ${sesiName} dengan email lain.` }, { status: 400 });
      }
    }

    // 4. Generate new token if not provided
    const newToken = local_token || uuidv4();

    // 5. Insert ke Database — kolom Sesi menyimpan "Pagi" atau "Siang"
    const { error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        email,
        nama_peserta,
        role,
        nim_nip,
        Sesi: sesiName,
        visitor_id,
        local_token: newToken,
        latitude,
        longitude
      });

    if (insertError) {
      console.error('Insert error:', insertError);
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
      eligibleForCertificate
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

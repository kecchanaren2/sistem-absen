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
  // Try to get client IP from headers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             req.headers.get('x-real-ip') ||
             'unknown';
  return ip;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    // New window
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Rate limited
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
    const { email, nama_peserta, role, nim_nip, hari_absen: Sesi_input, visitor_id, local_token, latitude, longitude } = body;

    // 1. Basic Validation
    if (!email || !nama_peserta || !nim_nip || !Sesi_input || !visitor_id || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    // Validate NIM / NIP format
    const cleanNimNip = String(nim_nip).trim();
    if (role === 'dosen') {
      if (!/^\d{12}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIP harus berupa 12 digit angka.' }, { status: 400 });
      }
    } else {
      // Default Mahasiswa
      if (!/^\d{10}$/.test(cleanNimNip)) {
        return NextResponse.json({ error: 'NIM harus berupa 10 digit angka.' }, { status: 400 });
      }
    }

    const sessionId = Number(Sesi_input) as 1 | 2;

    // Validate hari_absen / session
    if (![1, 2].includes(sessionId)) {
      return NextResponse.json({ error: 'Sesi absensi tidak valid.' }, { status: 400 });
    }

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
    // a. Check if Email + Hari already exists (Handled by DB Unique Constraint, but let's check manually for better error message)
    const { data: existingEntry } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('email', email)
      .eq('Sesi', sessionId)
      .maybeSingle();

    if (existingEntry) {
      return NextResponse.json({ error: `Anda sudah melakukan absensi untuk Sesi ${SESSION_SCHEDULES[sessionId].name}.` }, { status: 400 });
    }

    // b. Check if visitor_id is already used by a different email today
    const { data: fingerprintEntry } = await supabaseAdmin
      .from('attendance')
      .select('email')
      .eq('visitor_id', visitor_id)
      .eq('Sesi', sessionId)
      .neq('email', email)
      .limit(1)
      .maybeSingle();

    if (fingerprintEntry) {
      return NextResponse.json({ error: `Perangkat ini sudah digunakan untuk absen Sesi ${SESSION_SCHEDULES[sessionId].name} dengan email lain.` }, { status: 400 });
    }

    // c. Check if local_token is used by a different email today
    if (local_token) {
      const { data: tokenEntry } = await supabaseAdmin
        .from('attendance')
        .select('email')
        .eq('local_token', local_token)
        .eq('Sesi', sessionId)
        .neq('email', email)
        .limit(1)
        .maybeSingle();

      if (tokenEntry) {
        return NextResponse.json({ error: `Browser ini sudah digunakan untuk absen Sesi ${SESSION_SCHEDULES[sessionId].name} dengan email lain.` }, { status: 400 });
      }
    }

    // 4. Generate new token if not provided
    const newToken = local_token || uuidv4();

    // 5. Insert into Database
    const { error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        email,
        nama_peserta,
        nim_nip,
        hari_absen: sessionId,
        visitor_id,
        local_token: newToken,
        latitude,
        longitude
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Gagal menyimpan data absensi.' }, { status: 500 });
    }

    // 6. Check Certificate Eligibility (If Session 2 / Siang, check if they attended Session 1 / Pagi)
    let eligibleForCertificate = false;
    if (sessionId === 2) {
      const { data: day1Data } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('email', email)
        .eq('Sesi', 1)
        .maybeSingle();

      if (day1Data) {
        eligibleForCertificate = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Absensi Sesi ${SESSION_SCHEDULES[sessionId].name} berhasil disimpan!`,
      local_token: newToken,
      eligibleForCertificate
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDistanceInMeters, EVENT_LATITUDE, EVENT_LONGITUDE, MAX_DISTANCE_METERS } from '@/lib/haversine';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, nama_peserta, nim_nip, hari_absen, visitor_id, local_token, latitude, longitude } = body;

    // 1. Basic Validation
    if (!email || !nama_peserta || !nim_nip || !hari_absen || !visitor_id || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (![1, 2].includes(Number(hari_absen))) {
      return NextResponse.json({ error: 'Invalid hari_absen value' }, { status: 400 });
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
    const { data: existingEntry, error: checkError } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('email', email)
      .eq('hari_absen', hari_absen)
      .single();

    if (existingEntry) {
      return NextResponse.json({ error: 'Anda sudah melakukan absensi pada hari ini.' }, { status: 400 });
    }

    // b. Check if visitor_id is already used by a different email today
    const { data: fingerprintEntry } = await supabaseAdmin
      .from('attendance')
      .select('email')
      .eq('visitor_id', visitor_id)
      .eq('hari_absen', hari_absen)
      .neq('email', email)
      .limit(1)
      .single();

    if (fingerprintEntry) {
      return NextResponse.json({ error: 'Perangkat ini sudah digunakan untuk absen dengan email lain hari ini.' }, { status: 400 });
    }

    // c. Check if local_token is used by a different email today
    if (local_token) {
      const { data: tokenEntry } = await supabaseAdmin
        .from('attendance')
        .select('email')
        .eq('local_token', local_token)
        .eq('hari_absen', hari_absen)
        .neq('email', email)
        .limit(1)
        .single();

      if (tokenEntry) {
        return NextResponse.json({ error: 'Browser ini sudah digunakan untuk absen dengan email lain hari ini (Token Terdeteksi).' }, { status: 400 });
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
        hari_absen,
        visitor_id,
        local_token: newToken,
        latitude,
        longitude
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Gagal menyimpan data absensi.' }, { status: 500 });
    }

    // 6. Check Certificate Eligibility (If Day 2, check if they attended Day 1)
    let eligibleForCertificate = false;
    if (Number(hari_absen) === 2) {
      const { data: day1Data } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('email', email)
        .eq('hari_absen', 1)
        .single();

      if (day1Data) {
        eligibleForCertificate = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Absensi berhasil disimpan!',
      local_token: newToken,
      eligibleForCertificate
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}

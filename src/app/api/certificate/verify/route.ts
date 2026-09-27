import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isCertificateOpen } from '@/lib/certificate-access';

// ============================================
// RATE LIMITING (Simple In-Memory Store)
// ============================================
// Prevents scripted enumeration of NIM/NIP values, which would otherwise
// let anyone scrape names of every participant by guessing NIM numbers.
// NOTE: this in-memory store resets per serverless instance on Vercel, so
// it's a best-effort mitigation, not a hard guarantee — pair with Upstash
// Redis / Vercel KV for a production-grade limit if abuse is a real concern.
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

export async function POST(req: Request) {
  try {
    if (!isCertificateOpen()) {
      return NextResponse.json(
        { error: 'Portal sertifikat belum dibuka.' },
        { status: 423 }
      );
    }

    const body = await req.json();
    const { nim_nip, visitor_id } = body;

    // Check rate limit (Kombinasi 2 Lapis: IP dan Visitor ID)
    const ip = getRateLimitKey(req);
    const ipKey = `IP:${ip}`;
    const fpKey = `FP:${visitor_id || 'unknown'}`;

    // Lapisan 1: Limit IP (sangat longgar — keamanan utama ada di Geofencing + Jadwal + Unique Index NIM)
    // 1.000/menit = akomodasi hingga 1.000 mahasiswa WiFi kampus yang berbagi 1 IP dalam 1 menit
    if (!checkRateLimit(ipKey, 1000)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request dari jaringan ini. Silakan coba lagi nanti.' },
        { status: 429 }
      );
    }

    // Lapisan 2: Limit Perangkat (ketat untuk mencegah spam visitor_id palsu)
    if (!checkRateLimit(fpKey, 10)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request dari perangkat ini. Silakan coba lagi nanti.' },
        { status: 429 }
      );
    }

    if (!nim_nip) {
      return NextResponse.json({ error: 'NIM/NIP wajib diisi.' }, { status: 400 });
    }

    const cleanNimNip = String(nim_nip).trim();

    // Query attendance records for this NIM/NIP
    const { data: attendanceRecords, error } = await supabaseAdmin
      .from('attendance')
      .select('Sesi, nama_peserta, role, nim_nip')
      .eq('nim_nip', cleanNimNip);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Terjadi kesalahan saat mengecek data absensi.' }, { status: 500 });
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      return NextResponse.json({ error: 'Data absensi tidak ditemukan untuk NIM/NIP tersebut.' }, { status: 404 });
    }

    // Check sessions
    const hasPagi = attendanceRecords.some(record => record.Sesi === 'Pagi');
    const hasSiang = attendanceRecords.some(record => record.Sesi === 'Siang');

    if (hasPagi && hasSiang) {
      // Panitia names must always come from the whitelist, never from form input.
      const firstRecord = attendanceRecords[0];
      let namaPeserta = firstRecord.nama_peserta;

      if (firstRecord.role === 'panitia_mahasiswa') {
        const { data: panitia, error: panitiaError } = await supabaseAdmin
          .from('Panitia Mahasiswa')
          .select('Nama')
          .eq('NIM', cleanNimNip)
          .maybeSingle();

        if (panitiaError) {
          console.error('Panitia Mahasiswa lookup error:', panitiaError);
          return NextResponse.json({ error: 'Gagal memvalidasi nama Panitia Mahasiswa.' }, { status: 500 });
        }
        if (!panitia) {
          return NextResponse.json({ error: 'Data Panitia Mahasiswa tidak ditemukan.' }, { status: 404 });
        }
        namaPeserta = panitia.Nama;
      } else if (firstRecord.role === 'panitia_dosen') {
        const { data: panitia, error: panitiaError } = await supabaseAdmin
          .from('Panitia Dosen')
          .select('Nama')
          .eq('NIP', cleanNimNip)
          .maybeSingle();

        if (panitiaError) {
          console.error('Panitia Dosen lookup error:', panitiaError);
          return NextResponse.json({ error: 'Gagal memvalidasi nama Panitia Dosen.' }, { status: 500 });
        }
        if (!panitia) {
          return NextResponse.json({ error: 'Data Panitia Dosen tidak ditemukan.' }, { status: 404 });
        }
        namaPeserta = panitia.Nama;
      }

      const role = firstRecord.role;
      return NextResponse.json({
        eligible: true,
        nama_peserta: namaPeserta,
        role: role,
        message: 'Verifikasi berhasil! Anda berhak mengunduh sertifikat.'
      });
    } else {
      let missingSession = '';
      if (!hasPagi && !hasSiang) missingSession = 'Sesi Pagi dan Sesi Siang';
      else if (!hasPagi) missingSession = 'Sesi Pagi';
      else missingSession = 'Sesi Siang';

      return NextResponse.json({
        eligible: false,
        error: `Anda belum menyelesaikan absensi. Anda belum absen pada: ${missingSession}.`
      }, { status: 400 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
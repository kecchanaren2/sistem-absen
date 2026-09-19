import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
const RATE_LIMIT_MAX = 100; // Dinaikkan ke 100 untuk antisipasi mahasiswa pakai WiFi Kampus yang IP-nya sama

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

export async function POST(req: Request) {
  try {
    // Check rate limit first, before touching the database
    const clientKey = getRateLimitKey(req);
    if (!checkRateLimit(clientKey)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan verifikasi. Silakan coba lagi dalam beberapa saat.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { nim_nip } = body;

    if (!nim_nip) {
      return NextResponse.json({ error: 'NIM/NIP wajib diisi.' }, { status: 400 });
    }

    const cleanNimNip = String(nim_nip).trim();

    // Query attendance records for this NIM/NIP
    const { data: attendanceRecords, error } = await supabaseAdmin
      .from('attendance')
      .select('Sesi, nama_peserta, role')
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
      // Get the name and role from the first record
      const namaPeserta = attendanceRecords[0].nama_peserta;
      const role = attendanceRecords[0].role;
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
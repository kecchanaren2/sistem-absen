import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Simple In-Memory Rate Limiting
const checkRequests = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_CHECKS_PER_MINUTE = 60; // 60 requests per minute per IP

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = checkRequests.get(ip);

  if (!record || now > record.resetTime) {
    checkRequests.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_CHECKS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan pengecekan. Silakan tunggu beberapa saat.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { nim_nip } = body;

    const cleanNimNip = String(nim_nip || '').trim();
    if (!cleanNimNip || !/^\d{1,24}$/.test(cleanNimNip)) {
      return NextResponse.json(
        { error: 'Format NIM/NIP tidak valid (harus berupa angka).' },
        { status: 400 }
      );
    }

    // Fast indexed query on attendance table
    const { data: records, error } = await supabaseAdmin
      .from('attendance')
      .select('Sesi, nama_peserta, role, created_at')
      .eq('nim_nip', cleanNimNip);

    if (error) {
      console.error('Check status error:', error);
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat memeriksa database.' },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        found: false,
        nim_nip: cleanNimNip,
        message: 'Belum ada catatan absensi untuk NIM/NIP tersebut.',
      });
    }

    const pagiRecord = records.find((r) => r.Sesi === 'Pagi');
    const siangRecord = records.find((r) => r.Sesi === 'Siang');
    const firstRecord = pagiRecord || siangRecord || records[0];

    const pagiWaktu = pagiRecord?.created_at
      ? new Date(pagiRecord.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
      : undefined;

    const siangWaktu = siangRecord?.created_at
      ? new Date(siangRecord.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
      : undefined;

    return NextResponse.json({
      found: true,
      nim_nip: cleanNimNip,
      nama: firstRecord.nama_peserta || '',
      role: firstRecord.role || '',
      hasPagi: !!pagiRecord,
      hasSiang: !!siangRecord,
      pagiWaktu,
      siangWaktu,
      eligibleForCertificate: !!pagiRecord && !!siangRecord,
    });
  } catch (err) {
    console.error('API Check Error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal server.' },
      { status: 500 }
    );
  }
}

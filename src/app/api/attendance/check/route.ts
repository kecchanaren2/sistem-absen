import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Simple In-Memory Rate Limiting
const checkRequests = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
// Dilonggarkan ke 1.000 untuk mengakomodasi ribuan mahasiswa yang berbagi WiFi kampus
const MAX_CHECKS_PER_MINUTE = 1000;

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

const isPagi = (sesi?: string) => {
  if (!sesi) return false;
  const s = String(sesi).trim().toLowerCase();
  return s.startsWith('pagi') || s === '1';
};

const isSiang = (sesi?: string) => {
  if (!sesi) return false;
  const s = String(sesi).trim().toLowerCase();
  return s.startsWith('siang') || s === '2';
};

// 10:00 WITA = 02:00 UTC pada 28 September 2026
const isMorningTimestamp = (createdAt?: string) => {
  if (!createdAt) return false;
  try {
    const d = new Date(createdAt);
    return d.getTime() < new Date('2026-09-28T02:00:00Z').getTime();
  } catch {
    return false;
  }
};

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
    const { nim_nip, email } = body;

    const cleanNimNip = String(nim_nip || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanNimNip && !cleanEmail) {
      return NextResponse.json(
        { error: 'Harap masukkan NIM/NIP atau Email untuk memeriksa status.' },
        { status: 400 }
      );
    }

    let records: any[] = [];

    // 1. Query berdasarkan NIM/NIP
    if (cleanNimNip) {
      const { data: nimRecords, error: nimError } = await supabaseAdmin
        .from('attendance')
        .select('id, Sesi, nama_peserta, role, created_at, email, nim_nip')
        .eq('nim_nip', cleanNimNip);

      if (nimError) {
        console.error('Check status error (NIM):', nimError);
      } else if (nimRecords) {
        records = [...nimRecords];
      }
    }

    // 2. Fallback pencocokan Email jika Sesi Pagi belum terdeteksi dari NIM saja
    // (Menyelamatkan peserta yang typo 1 angka NIM antara Sesi Pagi & Siang)
    const emailToSearch = cleanEmail || (records.length > 0 && records[0]?.email ? String(records[0].email).trim().toLowerCase() : '');
    const hasPagiInRecords = records.some((r) => isPagi(r.Sesi) || isMorningTimestamp(r.created_at));

    if (emailToSearch && !hasPagiInRecords) {
      const { data: emailRecords, error: emailError } = await supabaseAdmin
        .from('attendance')
        .select('id, Sesi, nama_peserta, role, created_at, email, nim_nip')
        .ilike('email', emailToSearch);

      if (emailError) {
        console.error('Check status error (Email fallback):', emailError);
      } else if (emailRecords && emailRecords.length > 0) {
        // Gabungkan catatan unik
        const existingIds = new Set(records.map((r) => r.id || `${r.nim_nip}-${r.Sesi}`));
        emailRecords.forEach((er) => {
          const key = er.id || `${er.nim_nip}-${er.Sesi}`;
          if (!existingIds.has(key)) {
            records.push(er);
          }
        });
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        found: false,
        nim_nip: cleanNimNip,
        message: 'Belum ada catatan absensi untuk NIM/NIP tersebut.',
      });
    }

    const pagiRecord = records.find((r) => isPagi(r.Sesi) || isMorningTimestamp(r.created_at));
    const siangRecord = records.find((r) => isSiang(r.Sesi) && !isMorningTimestamp(r.created_at));
    const firstRecord = pagiRecord || siangRecord || records[0];

    const pagiWaktu = pagiRecord?.created_at
      ? new Date(pagiRecord.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
      : undefined;

    const siangWaktu = siangRecord?.created_at
      ? new Date(siangRecord.created_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
      : undefined;

    return NextResponse.json({
      found: true,
      nim_nip: cleanNimNip || firstRecord.nim_nip,
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

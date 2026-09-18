import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
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

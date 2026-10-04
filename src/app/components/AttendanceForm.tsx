'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  UserCheck,
  Award,
  Sun,
  Moon,
  X,
  ShieldCheck,
  Search
} from 'lucide-react';
import { getSessionStatus, SESSION_SCHEDULES, SessionStatus } from '@/lib/schedule';
import QRCodeWidget from './QRCodeWidget';

export interface AttendanceRecord {
  nama: string;
  nimNip: string;
  sesi: string;
  waktu: string;
  role?: string;
}

export const ROLES_LIST = [
  { value: 'panitia_mahasiswa', label: 'Panitia Mahasiswa', group: 'Panitia' },
  { value: 'panitia_dosen', label: 'Panitia Dosen', group: 'Panitia' },
  { value: 'peserta_mahasiswa', label: 'Peserta Mahasiswa', group: 'Peserta' },
  { value: 'peserta_tendik', label: 'Peserta Tendik', group: 'Peserta' },
  { value: 'peserta_dosen', label: 'Peserta Dosen', group: 'Peserta' },
] as const;

export function getRoleLabel(roleValue?: string): string {
  if (!roleValue) return 'Peserta Mahasiswa';
  const found = ROLES_LIST.find((r) => r.value === roleValue);
  if (found) return found.label;
  if (
    roleValue === 'Panitia Mahasiswa' ||
    roleValue === 'Panitia Dosen' ||
    roleValue === 'Peserta Mahasiswa' ||
    roleValue === 'Peserta Tendik' ||
    roleValue === 'Peserta Dosen'
  ) {
    return roleValue;
  }
  // Backwards compatibility for single-word / legacy roles
  const lower = roleValue.toLowerCase();
  if (lower === 'panitia') return 'Panitia';
  if (lower === 'peserta') return 'Peserta';
  if (lower === 'dosen') return 'Dosen';
  if (lower === 'tendik') return 'Tendik';
  if (lower === 'mahasiswa') return 'Mahasiswa';

  return roleValue
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Dual-layer storage helpers (LocalStorage + Cookie fallback)
function saveLocalAttendanceRecord(
  sesi: number,
  record: AttendanceRecord
) {
  if (typeof window === 'undefined') return;
  const recordStr = JSON.stringify(record);

  // Layer 1: LocalStorage
  try {
    localStorage.setItem('absen_history_sesi_' + sesi, recordStr);
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // Layer 2: Cookie (24 hours expiry, SameSite=Lax, Secure on HTTPS)
  try {
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    const encoded = encodeURIComponent(recordStr);
    document.cookie = `absen_history_sesi_${sesi}=${encoded}; path=/; max-age=86400; SameSite=Lax${isSecure}`;
  } catch (err) {
    console.warn('Cookie save error:', err);
  }
}

function getLocalAttendanceRecord(
  sesi: number
): AttendanceRecord | null {
  if (typeof window === 'undefined') return null;

  // Layer 1: LocalStorage (Fastest)
  try {
    const saved = localStorage.getItem('absen_history_sesi_' + sesi);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch { }

  // Layer 2: Cookie fallback (In case LocalStorage was purged by iOS Safari private mode or browser cleaning)
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )absen_history_sesi_${sesi}=([^;]+)`));
    if (match && match[1]) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      // Self-heal: sync back to LocalStorage
      try {
        localStorage.setItem('absen_history_sesi_' + sesi, JSON.stringify(parsed));
      } catch { }
      return parsed;
    }
  } catch { }

  return null;
}

export default function AttendanceForm() {
  const [email, setEmail] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [role, setRole] = useState<'panitia_mahasiswa' | 'panitia_dosen' | 'peserta_mahasiswa' | 'peserta_tendik' | 'peserta_dosen'>('peserta_dosen');
  const [nimNip, setNimNip] = useState('');
  const [hariAbsen, setHariAbsen] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);

  // States for automatic large success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    nama: string;
    nimNip: string;
    sesi: string;
    waktu: string;
    role?: string;
    roleLabel?: string;
    isEligible: boolean;
    message: string;
    isAlreadyRecorded?: boolean;
    hasPagi?: boolean;
    hasSiang?: boolean;
  } | null>(null);

  // States for tracking attendance status of both sessions on this device
  const [hasLocalPagi, setHasLocalPagi] = useState(false);
  const [hasLocalSiang, setHasLocalSiang] = useState(false);

  // States for local device history (reassurance on page reload)
  const [localHistory, setLocalHistory] = useState<AttendanceRecord | null>(null);

  // States for Quick Attendance Status Checker Modal
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkNimNip, setCheckNimNip] = useState('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    found: boolean;
    nama?: string;
    nim_nip?: string;
    role?: string;
    hasPagi?: boolean;
    hasSiang?: boolean;
    pagiWaktu?: string;
    siangWaktu?: string;
    eligibleForCertificate?: boolean;
    message?: string;
  } | null>(null);

  // Realtime Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // Theme state (Dark / Light mode)
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState(false);

  const [roleOpen, setRoleOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  const [showConfirm, setShowConfirm] = useState(false);

  // Schedules state
  const [status1, setStatus1] = useState<SessionStatus>(() => getSessionStatus(1));
  const [status2, setStatus2] = useState<SessionStatus>(() => getSessionStatus(2));

  const isPanitiaRole = role === 'panitia_mahasiswa' || role === 'panitia_dosen';

  // Initialize theme
  useEffect(() => {
    // Synchronize client-side theme mounted state
    const timer = setTimeout(() => {
      setIsMounted(true);
      const isDarkCurrent = document.documentElement.classList.contains('dark');
      setIsDark(isDarkCurrent);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    // Update live clock & session status
    const updateTick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Makassar',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );

      const s1 = getSessionStatus(1, now);
      const s2 = getSessionStatus(2, now);
      setStatus1(s1);
      setStatus2(s2);

    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Self-heal and sync attendance history from database into local device storage
  const syncStatusFromDatabase = async (inputNim: string) => {
    const clean = inputNim.trim();
    if (!clean || clean.length < 8) return null;

    try {
      const res = await fetch('/api/attendance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nim_nip: clean, email: email ? email.trim() : undefined }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      if (result.found) {
        if (result.hasPagi) {
          saveLocalAttendanceRecord(1, {
            nama: result.nama || namaPeserta || 'Peserta',
            nimNip: clean,
            sesi: 'Pagi',
            waktu: result.pagiWaktu || 'Pagi Hari Ini',
            role: result.role,
          });
          setHasLocalPagi(true);
        }
        if (result.hasSiang) {
          saveLocalAttendanceRecord(2, {
            nama: result.nama || namaPeserta || 'Peserta',
            nimNip: clean,
            sesi: 'Siang',
            waktu: result.siangWaktu || 'Siang Hari Ini',
            role: result.role,
          });
          setHasLocalSiang(true);
        }
        if (result.role && ['peserta_tendik', 'peserta_dosen'].includes(result.role)) {
          setRole(result.role as any);
        }
        if (result.nama && !namaPeserta && role !== 'panitia_mahasiswa' && role !== 'panitia_dosen') {
          setNamaPeserta(result.nama);
        }
        try {
          localStorage.setItem('absen_last_nim', clean);
        } catch { }
        const currentRec = getLocalAttendanceRecord(hariAbsen);
        setLocalHistory(currentRec);
        return result;
      }
    } catch {
      // Silent in background
    }
    return null;
  };

  // Load local device history on session change / mount (Dual-layer: LocalStorage + Cookie)
  useEffect(() => {
    const record = getLocalAttendanceRecord(hariAbsen);
    setLocalHistory(record);
    const pagiExists = !!getLocalAttendanceRecord(1);
    const siangExists = !!getLocalAttendanceRecord(2);
    setHasLocalPagi(pagiExists);
    setHasLocalSiang(siangExists);

    // Auto-sync for attendees who attended Sesi 1 earlier this morning
    if (!pagiExists && typeof window !== 'undefined') {
      try {
        const lastNim = localStorage.getItem('absen_last_nim');
        if (lastNim && lastNim.length >= 8) {
          syncStatusFromDatabase(lastNim);
        }
      } catch { }
    }
  }, [hariAbsen, showSuccessModal]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!roleOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [roleOpen]);

  const handleNimBlur = () => {
    if (nimNip && nimNip.trim().length >= 8) {
      syncStatusFromDatabase(nimNip);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = checkNimNip.trim();
    if (!clean) return;

    setIsCheckingStatus(true);
    setCheckResult(null);

    try {
      const res = await fetch('/api/attendance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nim_nip: clean, email: email ? email.trim() : undefined }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal memeriksa status');
      }
      setCheckResult(result);

      // Self-heal and restore local proof of attendance from database record
      if (result.found) {
        if (result.hasPagi) {
          saveLocalAttendanceRecord(1, {
            nama: result.nama || 'Peserta',
            nimNip: clean,
            sesi: 'Pagi',
            waktu: result.pagiWaktu || 'Pagi Hari Ini',
            role: result.role,
          });
          setHasLocalPagi(true);
        }
        if (result.hasSiang) {
          saveLocalAttendanceRecord(2, {
            nama: result.nama || 'Peserta',
            nimNip: clean,
            sesi: 'Siang',
            waktu: result.siangWaktu || 'Siang Hari Ini',
            role: result.role,
          });
          setHasLocalSiang(true);
        }
        if (result.role && ['peserta_tendik', 'peserta_dosen'].includes(result.role)) {
          setRole(result.role as any);
        }
        try {
          localStorage.setItem('absen_last_nim', clean);
        } catch { }
        const currentRec = getLocalAttendanceRecord(hariAbsen);
        setLocalHistory(currentRec);
        if (result.nama && !namaPeserta && role !== 'panitia_mahasiswa' && role !== 'panitia_dosen') {
          setNamaPeserta(result.nama);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memeriksa status';
      setCheckResult({ found: false, message: msg });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const selectedSessionStatus = hariAbsen === 1 ? status1 : status2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation for NIM / NIP format
    const cleanNimNip = nimNip.trim();
    const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';

    if (!cleanNimNip) {
      setMessage({
        text: isDosenRole ? 'NIP tidak boleh kosong.' : 'NIM tidak boleh kosong.',
        type: 'error',
      });
      return;
    }

    if (isDosenRole) {
      if (!/^\d{1,24}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIP harus berupa angka maksimal 24 digit.', type: 'error' });
        return;
      }
    } else {
      if (!/^\d{1,14}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIM harus berupa angka maksimal 14 digit.', type: 'error' });
        return;
      }
    }

    if (!selectedSessionStatus.isOpen) {
      setMessage({ text: 'Absensi sedang ditutup.', type: 'error' });
      return;
    }

    setShowConfirm(true);
  };

  const executeSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setShowConfirm(false);
    setIsLoading(true);
    setMessage(null);

    const cleanNimNip = nimNip.trim();

    try {
      // 1. Get Local Token
      const localToken = localStorage.getItem('absen_local_token') || '';

      // 2. Submit to API
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          nama_peserta: namaPeserta,
          role,
          nim_nip: cleanNimNip,
          Sesi: hariAbsen,
          local_token: localToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Smart Duplicate Interceptor:
        // Jika server mendeteksi sudah tercatat absen sebelumnya (misal akibat koneksi sempat lag atau submit ulang)
        if (data.already_attended || data.error?.toLowerCase().includes('sudah tercatat absen') || data.error?.toLowerCase().includes('ganda')) {
          const sesiText = data.sesi || (hariAbsen === 1 ? 'Pagi' : 'Siang');
          const finalName = data.nama_peserta || namaPeserta || 'Peserta';
          const resolvedRole = data.role || role;
          const resolvedRoleLabel = getRoleLabel(resolvedRole);
          const currentTimeFormatted = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA';

          const localPagi = !!getLocalAttendanceRecord(1);
          const localSiang = !!getLocalAttendanceRecord(2);
          const hasPagi = sesiText === 'Pagi' ? true : (data.eligibleForCertificate ? true : localPagi);
          const hasSiang = sesiText === 'Siang' ? true : localSiang;
          const isEligible = !!data.eligibleForCertificate || hasPagi || hasSiang;

          // Retrieve existing local record before saving to preserve the original attendance timestamp
          const existingLocal = getLocalAttendanceRecord(hariAbsen);
          const recordedTime = data.waktu || existingLocal?.waktu || currentTimeFormatted;

          // Simpan riwayat perangkat lokal (Dual-layer: LocalStorage + Cookie)
          const hist: AttendanceRecord = {
            nama: finalName,
            nimNip: cleanNimNip,
            sesi: sesiText,
            waktu: recordedTime,
            role: resolvedRole,
          };
          saveLocalAttendanceRecord(hariAbsen, hist);
          if (isEligible && !getLocalAttendanceRecord(1)) {
            saveLocalAttendanceRecord(1, {
              nama: finalName,
              nimNip: cleanNimNip,
              sesi: 'Pagi',
              waktu: getLocalAttendanceRecord(1)?.waktu || 'Terverifikasi di Database',
              role: resolvedRole,
            });
          }
          try {
            localStorage.setItem('absen_last_nim', cleanNimNip);
          } catch { }
          setLocalHistory(hist);
          setHasLocalPagi(!!getLocalAttendanceRecord(1));
          setHasLocalSiang(!!getLocalAttendanceRecord(2));

          setSuccessModalData({
            nama: finalName,
            nimNip: cleanNimNip,
            sesi: sesiText,
            waktu: recordedTime,
            role: resolvedRole,
            roleLabel: resolvedRoleLabel,
            isEligible: isEligible,
            message: `Data Anda untuk Sesi ${sesiText} SUDAH TERCATAT RESMI di server. Anda tidak perlu mengulang absensi.`,
            isAlreadyRecorded: true,
            hasPagi,
            hasSiang,
          });
          setShowSuccessModal(true);
          setMessage({
            text: `Anda sudah tercatat absen di Sesi ${sesiText}. Data Anda aman tersimpan di database.`,
            type: 'success',
          });
          return;
        }

        throw new Error(data.error || 'Terjadi kesalahan');
      }

      // Save token if new
      if (data.local_token && !localToken) {
        localStorage.setItem('absen_local_token', data.local_token);
      }

      setMessage({ text: data.message, type: 'success' });
      const finalName = data.nama_peserta || namaPeserta;
      if (data.nama_peserta) {
        setNamaPeserta(data.nama_peserta);
      }
      const resolvedRole = data.role || role;
      const resolvedRoleLabel = getRoleLabel(resolvedRole);

      const localPagi = !!getLocalAttendanceRecord(1);
      const localSiang = !!getLocalAttendanceRecord(2);
      const hasPagi = hariAbsen === 1 ? true : (data.eligibleForCertificate ? true : localPagi);
      const hasSiang = hariAbsen === 2 ? true : localSiang;
      const isEligible = !!data.eligibleForCertificate || hasPagi || hasSiang;

      setEligibleForCertificate(isEligible);

      const currentTimeFormatted = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';

      // Simpan riwayat perangkat lokal (Dual-layer: LocalStorage + Cookie)
      const hist: AttendanceRecord = {
        nama: finalName,
        nimNip: cleanNimNip,
        sesi: hariAbsen === 1 ? 'Pagi' : 'Siang',
        waktu: currentTimeFormatted,
        role: resolvedRole,
      };
      saveLocalAttendanceRecord(hariAbsen, hist);
      if (isEligible && !getLocalAttendanceRecord(1)) {
        saveLocalAttendanceRecord(1, {
          nama: finalName,
          nimNip: cleanNimNip,
          sesi: 'Pagi',
          waktu: 'Selesai Pagi Hari Ini ✓',
          role: resolvedRole,
        });
      }
      try {
        localStorage.setItem('absen_last_nim', cleanNimNip);
      } catch { }
      setLocalHistory(hist);
      setHasLocalPagi(!!getLocalAttendanceRecord(1));
      setHasLocalSiang(!!getLocalAttendanceRecord(2));

      // Tampilkan popup sukses otomatis yang besar dan jelas
      setSuccessModalData({
        nama: finalName,
        nimNip: cleanNimNip,
        sesi: hariAbsen === 1 ? 'Pagi' : 'Siang',
        waktu: currentTimeFormatted,
        role: resolvedRole,
        roleLabel: resolvedRoleLabel,
        isEligible: isEligible,
        message: data.message || 'Absensi berhasil disimpan!',
        isAlreadyRecorded: false,
        hasPagi,
        hasSiang,
      });
      setShowSuccessModal(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      setMessage({ text: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // handleDownloadCertificate SENGAJA DIHAPUS dari halaman ini.
  // Alasan: fungsi ini menggunakan `role` dari dropdown form, bukan dari database,
  // sehingga user bisa memanipulasi role untuk mendapatkan template sertifikat yang salah.
  // Seluruh proses download sertifikat dipindahkan ke Portal Sertifikat (/sertifikat)
  // yang memverifikasi role langsung dari database (server-side).

  const ROLES = [
    { value: 'peserta_tendik', label: 'Peserta Tendik', group: 'Peserta' },
    { value: 'peserta_dosen', label: 'Peserta Dosen', group: 'Peserta' },
  ] as const;

  const selectedRole = ROLES.find((r) => r.value === role) || ROLES[0];
  const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';

  return (
    <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-[760px] mx-auto flex flex-col bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl sm:rounded-[28px] md:rounded-[32px] shadow-2xl overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] transition-all duration-300">
      {/* Header Banner with Exact Figma Gradient and Vector Iconography */}
      <div
        className="relative px-6 sm:px-8 md:px-10 pt-8 sm:pt-9 md:pt-10 pb-9 sm:pb-10 md:pb-11 text-white text-center flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(156.67deg, rgb(218, 60, 46) 0%, rgb(246, 207, 47) 100%)'
        }}
      >
        {/* Dies Iconograph Vector Background Overlay */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[576px] md:h-[680px] left-1/2 top-1/2 w-[487px] md:w-[600px] pointer-events-none opacity-85 mix-blend-screen select-none">
          <img
            alt=""
            src="/dies-iconograph.svg"
            className="absolute block inset-0 max-w-none size-full object-contain"
          />
        </div>

        {/* Ambient Blur Lights */}
        <div className="absolute bg-white/10 blur-[40px] -right-8 -top-8 rounded-full size-32 md:size-48 pointer-events-none" />
        <div className="absolute bg-[#ffee7c]/20 blur-[40px] -left-8 -bottom-8 rounded-full size-32 md:size-48 pointer-events-none" />


        {/* Top Header Actions */}
        {isMounted && (
          <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
            {/* QR Code Widget — pojok kiri atas card */}
            <QRCodeWidget
              logoUrl="/qr.png"
              colorDark="#114084"
              displaySize={64}
              downloadFilename="qr-absensi-dies64.png"
              showDownload={true}
              label=""
            />

            {/* Theme Toggle Button — pojok kanan atas */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Dark / Light Mode"
              className="absolute top-4 right-4 z-20 !min-h-0 !min-w-0 p-[5px] sm:p-1.5 rounded-full backdrop-blur-[12px] bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-200 active:scale-90 shadow-sm flex items-center justify-center"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-yellow-100 transition-transform duration-300 rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-white transition-transform duration-300 rotate-0 hover:-rotate-12" />
              )}
            </button>
          </div>
        )}

        {/* Frosted Logo Banner Capsule */}
        <div className="relative z-10 backdrop-blur-[12px] bg-white/35 border border-white/40 flex items-center justify-center gap-3.5 sm:gap-4 md:gap-5 px-5 sm:px-6 md:px-7 py-2 sm:py-2.5 rounded-[22px] md:rounded-[24px] mb-4 md:mb-5 shadow-sm">
          {/* Tut Wuri */}
          <img
            src="/logo/Tut Wuri.webp"
            alt="Logo Tut Wuri"
            className="h-8 sm:h-8 md:h-9 w-auto object-contain"
          />
          {/* UNUD */}
          <img
            src="/logo/unud.png"
            alt="Logo UNUD"
            className="h-8 sm:h-8 md:h-9 w-auto object-contain"
          />
          {/* Diktisaintek */}
          <img
            src="/logo/diktisaintek.png"
            alt="Logo Diktisaintek"
            className="h-8 sm:h-8 md:h-9 w-auto object-contain"
          />
          {/* PTNBH */}
          <img
            src="/logo/ptnbh.png"
            alt="Logo PTNBH"
            className="h-8 sm:h-8 md:h-9 w-auto object-contain"
          />
          {/* Dies */}
          <img
            src="/logo/dies.png"
            alt="Logo Dies Natalis"
            className="h-8 sm:h-8 md:h-9 w-auto object-contain"
          />
        </div>

        {/* Main Title */}
        <h2 className="relative z-10 text-3xl sm:text-4xl md:text-[2.6rem] font-extrabold tracking-[-0.75px] md:tracking-[-1px] text-white drop-shadow-sm mb-2 leading-none">
          PORTAL ABSENSI
        </h2>

        {/* Live Clock Server Time Badge */}
        {currentTime && (
          <div className="relative z-10 mt-1 flex items-center space-x-1.5 backdrop-blur-[12px] bg-black/25 dark:bg-black/35 px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm text-orange-50 font-mono border border-white/20 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-yellow-200" />
            <span>Waktu Server: {currentTime} WITA</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 md:p-9 flex flex-col space-y-5 md:space-y-6">
        {/* Local Device History Banner (0 network & 0 server cost) */}
        {localHistory && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start space-x-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950 dark:text-emerald-100">
                  Perangkat Ini Sudah Absen Sesi {localHistory.sesi}
                </div>
                <div className="text-[11px] sm:text-xs text-emerald-800/85 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                  Tercatat sebagai <strong className="font-semibold">{getRoleLabel(localHistory.role || role)}</strong> untuk <strong className="font-bold">{localHistory.nama}</strong> ({localHistory.nimNip}) pukul {localHistory.waktu}.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const localPagi = !!getLocalAttendanceRecord(1);
                const localSiang = !!getLocalAttendanceRecord(2);
                const hasPagi = localHistory.sesi === 'Pagi' || localPagi;
                const hasSiang = localHistory.sesi === 'Siang' || localSiang;
                const isEligible = hasPagi || hasSiang;
                const resolvedRole = localHistory.role || role;
                const resolvedRoleLabel = getRoleLabel(resolvedRole);

                setSuccessModalData({
                  nama: localHistory.nama,
                  nimNip: localHistory.nimNip,
                  sesi: localHistory.sesi,
                  waktu: localHistory.waktu,
                  role: resolvedRole,
                  roleLabel: resolvedRoleLabel,
                  isEligible: isEligible,
                  message: 'Bukti riwayat absensi pada perangkat ini.',
                  isAlreadyRecorded: true,
                  hasPagi,
                  hasSiang,
                });
                setShowSuccessModal(true);
              }}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 underline hover:text-emerald-800 whitespace-nowrap self-center cursor-pointer touch-manipulation"
            >
              Lihat Bukti
            </button>
          </div>
        )}

        {/* Dynamic Alerts */}
        {message && (
          <div
            className={`p-4 rounded-2xl flex items-start space-x-3 text-sm transition-all duration-300 ${message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 shadow-xs'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800/60 shadow-xs'
              }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{message.text}</span>
          </div>
        )}

        {/* Certificate Card */}
        {eligibleForCertificate && (
          <div className="p-5 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-orange-950/40 dark:via-amber-950/40 dark:to-yellow-950/40 rounded-2xl border border-orange-200/80 dark:border-orange-800/60 text-center shadow-md">
            <div className="inline-flex p-2 bg-orange-100 dark:bg-orange-900/60 rounded-full mb-2 text-orange-600 dark:text-orange-300">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#3d2417] dark:text-orange-100 mb-1">
              Selamat! Anda Berhak E-Sertifikat 🎉
            </h3>
            <p className="text-[#69422f] dark:text-orange-300 text-xs mb-4 leading-relaxed">
              Seluruh sesi absensi Anda telah tercatat. Silakan unduh sertifikat melalui Portal Sertifikat.
            </p>
            <a
              href="/sertifikat"
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-orange-500/20 touch-manipulation"
            >
              <Award className="w-4 h-4" />
              <span>Buka Portal Sertifikat</span>
            </a>
          </div>
        )}

        {/* Main Attendance Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {/* Status / Peran — Custom Dropdown */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              STATUS / PERAN
            </label>
            <div className="relative" ref={roleDropdownRef}>
              {/* Trigger */}
              <button
                type="button"
                id="role-dropdown-btn"
                onClick={() => setRoleOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all touch-manipulation active:scale-[0.99] cursor-pointer bg-[#efe7e2] dark:bg-[#34241d] shadow-xs ${roleOpen
                  ? 'border-orange-500 ring-2 ring-orange-500/20 text-[#2c1e18] dark:text-[#f5ece7] dark:border-orange-500'
                  : 'border-[#decbc0] dark:border-[#4f382c] text-[#2c1e18] dark:text-[#f5ece7] hover:border-orange-400 dark:hover:border-orange-500'
                  }`}
              >
                <span className="flex items-center space-x-2.5">
                  <UserCheck className="w-4 h-4 flex-shrink-0 text-orange-500" />
                  <span>{selectedRole.label}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#8f7d73] dark:text-[#a39086] transition-transform duration-200 ${roleOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {/* Dropdown panel */}
              {roleOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-[#decbc0] dark:border-[#4f382c] bg-[#fcfaf8] dark:bg-[#2b1c16] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Peserta group */}
                  <div className="px-3 pt-2.5 pb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#9d8a80] dark:text-[#8f7e75]">
                      Peserta
                    </span>
                  </div>
                  {ROLES.filter((r) => r.group === 'Peserta').map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        setRole(r.value);
                        setMessage(null);
                        setRoleOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold transition-colors touch-manipulation cursor-pointer active:scale-[0.99] ${role === r.value
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold'
                        : 'text-[#3d2b22] dark:text-[#e5d8d0] hover:bg-[#efe7e2] dark:hover:bg-[#38261e]'
                        }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${role === r.value ? 'bg-orange-500' : 'bg-[#decbc0] dark:bg-[#4f382c]'
                          }`}
                      />
                      <span>{r.label}</span>
                    </button>
                  ))}
                  <div className="h-1.5" />
                </div>
              )}
            </div>
          </div>

          {/* Nama Lengkap Input untuk peserta */}
          {!isPanitiaRole && <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              NAMA LENGKAP
            </label>
            <input
              type="text"
              required
              disabled={isPanitiaRole}
              value={namaPeserta}
              onChange={(e) => {
                setNamaPeserta(e.target.value.replace(/[^\p{L}\p{M} '\u2019-]/gu, ''));
              }}
              className={`w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation ${isPanitiaRole ? 'cursor-not-allowed opacity-80' : ''}`}
              placeholder={isPanitiaRole ? 'Nama akan muncul setelah NIM/NIP valid' : 'Masukkan nama sesuai identitas'}
              autoComplete="name"
            />
          </div>}

          {/* Email Input */}
          <div className="flex flex-col space-y-1">
            <div className="flex flex-col">
              <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
                EMAIL
              </label>
              <span className="text-[11px] text-[#9a7d6d] dark:text-[#c4a492] font-medium italic mt-0.5">
                *Email akan digunakan untuk sertifikat
              </span>
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation mt-0.5"
              placeholder="email@contoh.com"
              autoComplete="email"
            />
          </div>

          {/* NIM / NIP Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              {isDosenRole ? 'NIP' : 'NIM'}
            </label>
            <input
              type="text"
              required
              maxLength={isDosenRole ? 24 : 14}
              value={nimNip}
              onChange={(e) => {
                setNimNip(e.target.value.replace(/\D/g, ''));
              }}
              onBlur={handleNimBlur}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation font-mono tracking-wider"
              placeholder={isDosenRole ? 'Misal: 1981100720081210001' : 'Misal: 1234567890'}
              autoComplete="off"
            />
          </div>

          {/* Sesi Closed Banner */}
          {!selectedSessionStatus.isOpen && (
            <div className="p-3 bg-amber-500/10 dark:bg-[#382012] border border-amber-500/30 dark:border-[#6b3816] rounded-xl text-amber-900 dark:text-[#fcd34d] text-xs flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Absensi saat ini ditutup. ({selectedSessionStatus.message})
              </span>
            </div>
          )}

          {/* Submit / Action Button */}
          <button
            type="submit"
            disabled={!isMounted || isLoading || !selectedSessionStatus.isOpen}
            className={`w-full py-4 px-4 rounded-2xl font-bold text-base sm:text-lg transition-all flex justify-center items-center mt-3 touch-manipulation min-h-[52px] ${!isMounted || !selectedSessionStatus.isOpen ? 'bg-[#e6dcda] dark:bg-[#38261e] border border-[#d6c7c1] dark:border-[#4a3429] text-[#85726a] dark:text-[#8e786d] cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] active:scale-[0.98] text-white shadow-lg shadow-orange-500/25 cursor-pointer'
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2 flex-shrink-0" />
                <span className="truncate">Memproses Absensi...</span>
              </>
            ) : !selectedSessionStatus.isOpen ? (
              <span>Sesi Ditutup</span>
            ) : (
              <span>Absen Sekarang</span>
            )}
          </button>
          <span className="text-[11px] text-[#9a7d6d] dark:text-[#c4a492] font-medium italic mt-0.5">
            *setelah absensi, e-sertifikat dapat diunduh melalui portal sertifikat
          </span>

          <a
            href="/sertifikat"
            className="w-full py-3 px-4 rounded-2xl font-bold text-sm sm:text-base transition-all flex justify-center items-center border border-[#d7bca8] dark:border-[#4f382c] bg-[#f3e7e1] dark:bg-[#2c1d17] text-[#4d352b] dark:text-[#f5ece7] hover:bg-[#ebdfd8] dark:hover:bg-[#362620] active:scale-[0.98] shadow-sm"
          >
            Portal Sertifikat
          </a>

          {/* Quick Check Attendance Status Button */}
          <button
            type="button"
            onClick={() => {
              setCheckNimNip(nimNip.trim());
              setCheckResult(null);
              setShowCheckModal(true);
            }}
            className="w-full py-3 px-4 rounded-2xl font-bold text-sm sm:text-base transition-all flex justify-center items-center gap-2 border border-[#d7bca8] dark:border-[#4f382c] bg-white/70 dark:bg-[#1f140f] text-[#5a4439] dark:text-[#c9b8ae] hover:bg-[#efe7e2] dark:hover:bg-[#2c1d17] active:scale-[0.98] shadow-xs cursor-pointer touch-manipulation"
          >
            <Search className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span>Cek Status Kehadiran Saya</span>
          </button>
        </form>
      </div>

      {/* Custom Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
              </div>
              <h3 className="text-xl font-extrabold text-[#2c1e18] dark:text-[#f5ece7] mb-2">Konfirmasi Absensi</h3>
              <p className="text-sm text-[#7e695d] dark:text-[#b09d92] font-medium mb-6 leading-relaxed">
                PASTIKAN DATA ANDA SUDAH <strong className="text-amber-600 dark:text-amber-500">100% BENAR</strong>.<br />Absen hanya bisa dilakukan 1x per sesi dan tidak dapat diubah kembali.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={executeSubmit}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/25"
                >
                  Yakin, Kirim Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-[#5a4439] dark:text-[#c9b8ae] bg-[#efe7e2] dark:bg-[#34241d] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23] active:scale-[0.98] transition-all"
                >
                  Batal, Cek Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Large Automatic Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl sm:rounded-[32px] shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header Ribbon / Banner */}
            <div className={`relative px-6 pt-7 pb-6 text-white text-center flex flex-col items-center justify-center overflow-hidden flex-shrink-0 ${successModalData?.isEligible
              ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700'
              : successModalData?.isAlreadyRecorded
                ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700'
                : 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700'
              }`}>
              {/* Close Button X */}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/15 transition-all touch-manipulation active:scale-95 cursor-pointer"
                aria-label="Tutup popup"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Big Animated Icon */}
              <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white flex items-center justify-center shadow-xl mb-3 ring-8 ring-white/20 ${successModalData?.isEligible
                ? 'text-amber-600 shadow-amber-950/20'
                : successModalData?.isAlreadyRecorded
                  ? 'text-blue-600 shadow-blue-950/20'
                  : 'text-emerald-600 shadow-emerald-950/20'
                }`}>
                {successModalData?.isEligible ? (
                  <Award className="w-10 h-10 sm:w-12 sm:h-12 text-amber-600 stroke-[2.5]" />
                ) : successModalData?.isAlreadyRecorded ? (
                  <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 stroke-[2.5]" />
                ) : (
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 stroke-[2.5]" />
                )}
              </div>

              <span className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-white/90 bg-white/20 px-3 py-0.5 rounded-full mb-1">
                {successModalData?.isAlreadyRecorded ? 'Telah Terdaftar di Database' : 'Absensi Tercatat'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {successModalData?.isAlreadyRecorded ? 'Sudah Tercatat Absen!' : 'Absensi Berhasil!'}
              </h2>
              <p className="text-white/90 text-xs sm:text-sm mt-1 max-w-xs font-medium leading-relaxed">
                {successModalData?.isAlreadyRecorded
                  ? 'Data kehadiran Anda sudah aman tersimpan di database.'
                  : 'Selamat! Kehadiran Anda telah sukses diverifikasi dan berhak atas E-Sertifikat resmi.'}
              </p>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex flex-col space-y-3.5">
              {/* Contextual Notice Banner: Certificate Celebration */}
              {successModalData?.isEligible ? (
                <div className="p-4 bg-gradient-to-r from-amber-500/25 via-orange-500/25 to-amber-500/25 border-2 border-amber-500/60 rounded-2xl flex items-start space-x-3 text-left shadow-sm">
                  <Award className="w-7 h-7 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm sm:text-base text-amber-950 dark:text-amber-200">
                      Kehadiran Terverifikasi! 🎉
                    </h4>
                    <p className="text-xs sm:text-[13px] text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
                      Selamat! Kehadiran presensi Anda telah terverifikasi secara resmi untuk penerbitan E-Sertifikat.
                    </p>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 pt-0.5">
                      Silakan klik tombol di bawah untuk membuka Portal Sertifikat dan mengunduh sertifikat Anda.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/30 rounded-2xl flex items-start space-x-2.5 text-left text-xs text-blue-900 dark:text-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold">Informasi Sertifikat:</strong> Pastikan Anda telah melakukan absensi agar sertifikat dapat diproses.
                  </div>
                </div>
              )}

              {/* Summary Details Card */}
              <div className="bg-[#efe7e2] dark:bg-[#34241d] rounded-2xl p-4 border border-[#decbc0] dark:border-[#4f382c] space-y-2.5 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-[#decbc0]/60 dark:border-[#4f382c]/60">
                  <span className="text-xs font-bold text-[#7e695d] dark:text-[#b09d92] uppercase tracking-wider">
                    Status / Peran
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-[#2c1e18] dark:text-[#f5ece7] px-2.5 py-0.5 rounded-lg bg-[#decbc0]/50 dark:bg-[#4f382c]/50 border border-[#decbc0]/70 dark:border-[#4f382c]/70 shadow-xs">
                    {successModalData?.roleLabel || getRoleLabel(successModalData?.role || role)}
                  </span>
                </div>

                <div className="flex justify-between items-start pb-2 border-b border-[#decbc0]/60 dark:border-[#4f382c]/60">
                  <span className="text-xs font-bold text-[#7e695d] dark:text-[#b09d92] uppercase tracking-wider">
                    Nama Lengkap
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-[#2c1e18] dark:text-[#f5ece7] text-right max-w-[65%]">
                    {successModalData?.nama}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#decbc0]/60 dark:border-[#4f382c]/60">
                  <span className="text-xs font-bold text-[#7e695d] dark:text-[#b09d92] uppercase tracking-wider">
                    {(() => {
                      const modalRole = successModalData?.role || role;
                      const isModalDosen = modalRole === 'panitia_dosen' || modalRole === 'peserta_dosen' || modalRole === 'peserta_tendik';
                      return isModalDosen ? 'NIP' : 'NIM';
                    })()}
                  </span>
                  <span className="font-mono font-bold text-sm sm:text-base text-[#2c1e18] dark:text-[#f5ece7]">
                    {successModalData?.nimNip}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#decbc0]/60 dark:border-[#4f382c]/60">
                  <span className="text-xs font-bold text-[#7e695d] dark:text-[#b09d92] uppercase tracking-wider">
                    Status Validasi
                  </span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${successModalData?.isAlreadyRecorded ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                    <ShieldCheck className="w-4 h-4" />
                    Terverifikasi di Database
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#7e695d] dark:text-[#b09d92] uppercase tracking-wider">
                    Waktu Catatan
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#5a4439] dark:text-[#c9b8ae] flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    {successModalData?.waktu}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-1">
                {successModalData?.isEligible ? (
                  <>
                    <a
                      href="/sertifikat"
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-2 text-center text-sm sm:text-base touch-manipulation cursor-pointer"
                    >
                      <Award className="w-5 h-5 flex-shrink-0" />
                      <span>Klaim E-Sertifikat Sekarang</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowSuccessModal(false)}
                      className="w-full py-3.5 px-4 rounded-xl font-bold bg-[#efe7e2] dark:bg-[#34241d] text-[#5a4439] dark:text-[#c9b8ae] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23] border border-[#decbc0] dark:border-[#4f382c] transition-all active:scale-[0.98] text-sm sm:text-base touch-manipulation cursor-pointer"
                    >
                      Tutup Dialog
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/25 text-sm sm:text-base touch-manipulation cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Saya Mengerti, Akan Absen Siang Lagi</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Check Attendance Status Modal (Ultra Lightweight) */}
      {showCheckModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl sm:rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="relative px-6 pt-6 pb-5 text-center bg-gradient-to-br from-[#ea580c] via-[#f97316] to-[#f59e0b] text-white flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowCheckModal(false);
                  setCheckResult(null);
                }}
                className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/15 transition-all touch-manipulation active:scale-95 cursor-pointer"
                aria-label="Tutup modal cek"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mx-auto w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-2">
                <Search className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Cek Status Absensi
              </h3>
              <p className="text-xs text-orange-100 mt-0.5">
                Periksa apakah kehadiran Anda sudah tercatat di sistem
              </p>
            </div>

            {/* Form & Results */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <form onSubmit={handleCheckStatus} className="space-y-3">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
                    Masukkan NIM / NIP
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={checkNimNip}
                      onChange={(e) => setCheckNimNip(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 2108561001"
                      className="flex-1 px-4 py-3 text-sm rounded-xl border border-[#decbc0] dark:border-[#4f382c] bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] focus:ring-2 focus:ring-orange-500 font-mono"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={isCheckingStatus || !checkNimNip.trim()}
                      className="px-5 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-orange-500/20 flex items-center justify-center whitespace-nowrap cursor-pointer"
                    >
                      {isCheckingStatus ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Cek'
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Result Area */}
              {checkResult && (
                <div className="animate-in fade-in zoom-in-95 duration-150">
                  {checkResult.found ? (
                    <div className="bg-[#efe7e2] dark:bg-[#34241d] rounded-2xl p-4 border border-[#decbc0] dark:border-[#4f382c] space-y-3 text-sm">
                      <div className="pb-2 border-b border-[#decbc0]/60 dark:border-[#4f382c]/60">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
                          Nama Terdaftar
                        </div>
                        <div className="font-extrabold text-base text-[#2c1e18] dark:text-[#f5ece7] mt-0.5">
                          {checkResult.nama}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-[#7e695d] dark:text-[#a8968c]">
                            NIM/NIP: {checkResult.nim_nip}
                          </span>
                          {checkResult.role && (
                            <span className="text-[11px] font-bold text-[#2c1e18] dark:text-[#f5ece7] px-2 py-0.5 rounded bg-[#decbc0]/50 dark:bg-[#4f382c]/50 border border-[#decbc0]/70 dark:border-[#4f382c]/70">
                              {getRoleLabel(checkResult.role)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attendance Status */}
                      {(() => {
                        const attended = !!(checkResult.hasPagi || checkResult.hasSiang);
                        const waktu = checkResult.pagiWaktu || checkResult.siangWaktu;
                        return (
                          <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${attended
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                            : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400'
                            }`}>
                            <span className="text-xs font-bold">Status Kehadiran</span>
                            <span className="text-[11px] font-extrabold mt-1">{attended ? '✓ Sudah Absen' : '⏳ Belum Absen'}</span>
                            {attended && waktu && (
                              <span className="text-[10px] font-mono opacity-80 mt-0.5">{waktu}</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Certificate Status */}
                      <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start space-x-2 ${checkResult.eligibleForCertificate
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                        : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                        }`}>
                        <Award className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          {checkResult.eligibleForCertificate ? (
                            <>
                              <strong className="font-bold">Berhak E-Sertifikat! 🎉</strong> Kehadiran Anda telah tercatat. Sertifikat dapat diunduh di Portal Sertifikat.
                            </>
                          ) : (
                            <>
                              <strong className="font-bold">Belum Ada Presensi:</strong> Harap lakukan absensi terlebih dahulu untuk mendapatkan sertifikat.
                            </>
                          )}
                        </div>
                      </div>

                      {checkResult.eligibleForCertificate && (
                        <a
                          href="/sertifikat"
                          className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-600 to-amber-600 flex items-center justify-center gap-1.5 shadow-sm mt-1 cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                          <span>Buka Portal Sertifikat</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-900 dark:text-rose-200 flex items-start space-x-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                      <span>{checkResult.message || 'Belum ada data absensi untuk NIM/NIP tersebut.'}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowCheckModal(false);
                  setCheckResult(null);
                }}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-[#efe7e2] dark:bg-[#34241d] text-[#5a4439] dark:text-[#c9b8ae] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23] transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






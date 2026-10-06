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
    localStorage.setItem('workshop_history_sesi_' + sesi, recordStr);
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // Layer 2: Cookie (24 hours expiry, SameSite=Lax, Secure on HTTPS)
  try {
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    const encoded = encodeURIComponent(recordStr);
    document.cookie = `workshop_history_sesi_${sesi}=${encoded}; path=/; max-age=86400; SameSite=Lax${isSecure}`;
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
    const saved = localStorage.getItem('workshop_history_sesi_' + sesi);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch { }

  // Layer 2: Cookie fallback (In case LocalStorage was purged by iOS Safari private mode or browser cleaning)
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )workshop_history_sesi_${sesi}=([^;]+)`));
    if (match && match[1]) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      // Self-heal: sync back to LocalStorage
      try {
        localStorage.setItem('workshop_history_sesi_' + sesi, JSON.stringify(parsed));
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
          localStorage.setItem('workshop_last_nim', clean);
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
        const lastNim = localStorage.getItem('workshop_last_nim');
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
          localStorage.setItem('workshop_last_nim', clean);
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
            localStorage.setItem('workshop_last_nim', cleanNimNip);
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
        localStorage.setItem('workshop_last_nim', cleanNimNip);
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
    <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-[760px] mx-auto flex flex-col bg-[#f8f8fc] dark:bg-[#14182b] rounded-3xl sm:rounded-[28px] md:rounded-[32px] shadow-[0px_12px_32px_-12px_rgba(0,0,0,0.07)] dark:shadow-[0px_12px_32px_-12px_rgba(0,0,0,0.5)] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] transition-all duration-200">
      {/* Header Banner with Exact Figma Gradient (from #4c95e6 to #0467ff) */}
      <div className="relative px-5 sm:px-6 md:px-8 pt-6 sm:pt-7 md:pt-8 pb-7 sm:pb-8 text-white text-center flex flex-col items-center justify-center overflow-hidden bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8]">
        {/* Top Header Actions */}
        {isMounted && (
          <div className="w-full flex items-center justify-between gap-2 mb-4">
            {/* QR Code Widget — pojok kiri atas card */}
            <QRCodeWidget
              logoUrl="/qr.png"
              colorDark="#0467ff"
              displaySize={64}
              downloadFilename="qr-absensi-workshop.png"
              showDownload={true}
              label=""
            />

            {/* Crisp Logo Capsule — 6 Logos on clean white backdrop matching Figma */}
            <div className="bg-white drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2.5 sm:gap-3.5 md:gap-4 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full sm:rounded-[24px]">
              <img
                src="/logo/Tut Wuri.webp"
                alt="Logo Tut Wuri"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={27}
                height={27}
                loading="eager"
              />
              <img
                src="/logo/unud.png"
                alt="Logo UNUD"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={24}
                height={27}
                loading="eager"
              />
              <img
                src="/logo/diktisaintek.png"
                alt="Logo Diktisaintek"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={32}
                height={27}
                loading="eager"
              />
              <img
                src="/logo/ptnbh.png"
                alt="Logo PTNBH"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={38}
                height={27}
                loading="eager"
              />
              <img
                src="/logo/Logo Pelayanan 1.png"
                alt="Logo Pelayanan 1"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={24}
                height={27}
                loading="eager"
              />
              <img
                src="/logo/logo workshop.png"
                alt="logo workshop"
                className="h-5 sm:h-6 md:h-7 w-auto object-contain pointer-events-none"
                width={33}
                height={27}
                loading="eager"
              />
            </div>

            {/* Theme Toggle Button — pojok kanan atas */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Dark / Light Mode"
              className="!min-h-0 !min-w-0 p-[5px] sm:p-1.5 rounded-full bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-150 active:scale-90 shadow-sm flex items-center justify-center cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-white transition-transform duration-200 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-white transition-transform duration-200 hover:-rotate-12" />
              )}
            </button>
          </div>
        )}

        {/* Main Title */}
        <h2 className="relative z-10 text-3xl sm:text-4xl md:text-[40px] font-extrabold tracking-[-1px] text-white drop-shadow-xs mb-2 leading-none">
          PORTAL ABSENSI
        </h2>

        {/* Live Clock Server Time Badge */}
        {currentTime && (
          <div className="relative z-10 mt-1 flex items-center space-x-1.5 bg-black/25 dark:bg-black/35 px-3.5 sm:px-4 py-1 rounded-full text-xs font-mono text-[#edeeff] border border-white/20 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-blue-200" />
            <span>Waktu Server: {currentTime} WITA</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 md:p-8 flex flex-col space-y-4 sm:space-y-5 bg-[#f8f8fc] dark:bg-[#14182b]">
        {/* Local Device History Banner (0 network & 0 server cost) */}
        {localHistory && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start space-x-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-950 dark:text-emerald-100">
                  Perangkat ini sudah absen
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
          <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 text-center shadow-md">
            <div className="inline-flex p-2 bg-blue-100 dark:bg-blue-900/60 rounded-full mb-2 text-[#0066ff] dark:text-blue-300">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#18192c] dark:text-[#f1f3fd] mb-1">
              Selamat! Anda Berhak E-Sertifikat 🎉
            </h3>
            <p className="text-[#5d5f7e] dark:text-[#9aa0c2] text-xs mb-4 leading-relaxed">
              Seluruh sesi absensi Anda telah tercatat. Silakan unduh sertifikat melalui Portal Sertifikat.
            </p>
            <a
              href="/sertifikat"
              className="w-full flex items-center justify-center space-x-2 bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-blue-500/20 touch-manipulation cursor-pointer"
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
            <label className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
              STATUS / PERAN
            </label>
            <div className="relative" ref={roleDropdownRef}>
              {/* Trigger */}
              <button
                type="button"
                id="role-dropdown-btn"
                onClick={() => setRoleOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-sm font-semibold transition-all touch-manipulation active:scale-[0.99] cursor-pointer bg-[#e2e3ef] dark:bg-[#1c223c] shadow-xs ${roleOpen
                  ? 'border-[#0066ff] ring-2 ring-[#0066ff]/20 text-[#18192c] dark:text-[#eef0fb] dark:border-[#0066ff]'
                  : 'border-[#c0c2de] dark:border-[#323b63] text-[#18192c] dark:text-[#eef0fb] hover:border-[#0066ff]/60'
                  }`}
              >
                <span className="flex items-center space-x-2.5">
                  <UserCheck className="w-4 h-4 flex-shrink-0 text-[#0066ff] dark:text-[#60a5fa]" />
                  <span>{selectedRole.label}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#5d5f7e] dark:text-[#9aa0c2] transition-transform duration-200 ${roleOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {/* Dropdown panel */}
              {roleOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-[#c0c2de] dark:border-[#323b63] bg-[#f8f8fc] dark:bg-[#191f37] shadow-xl overflow-hidden animate-in fade-in duration-100">
                  {/* Peserta group */}
                  <div className="px-3 pt-2.5 pb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#5d5f7e] dark:text-[#9aa0c2]">
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
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0066ff] dark:text-blue-300 font-bold'
                        : 'text-[#18192c] dark:text-[#eef0fb] hover:bg-[#e2e3ef] dark:hover:bg-[#252c4c]'
                        }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${role === r.value ? 'bg-[#0066ff]' : 'bg-[#c0c2de] dark:bg-[#323b63]'
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
            <label className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
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
              className={`w-full px-3.5 py-3 text-sm sm:text-base rounded-xl border border-[#c0c2de] dark:border-[#323b63] focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-[#e2e3ef] dark:bg-[#1c223c] text-[#18192c] dark:text-[#eef0fb] placeholder-[#84869e] dark:placeholder-[#6d779f] transition-all shadow-xs touch-manipulation ${isPanitiaRole ? 'cursor-not-allowed opacity-80' : ''}`}
              placeholder={isPanitiaRole ? 'Nama akan muncul setelah NIM/NIP valid' : 'Masukkan nama sesuai identitas'}
              autoComplete="name"
            />
          </div>}

          {/* Email Input */}
          <div className="flex flex-col space-y-1">
            <div className="flex flex-col">
              <label className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                EMAIL
              </label>
              <span className="text-[11px] text-[#6d709a] dark:text-[#8a92b5] font-medium mt-0.5">
                *Email akan digunakan untuk mengirim sertifikat
              </span>
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-3 text-sm sm:text-base rounded-xl border border-[#c0c2de] dark:border-[#323b63] focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-[#e2e3ef] dark:bg-[#1c223c] text-[#18192c] dark:text-[#eef0fb] placeholder-[#84869e] dark:placeholder-[#6d779f] transition-all shadow-xs touch-manipulation mt-0.5"
              placeholder="email@contoh.com"
              autoComplete="email"
            />
          </div>

          {/* NIM / NIP Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
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
              className="w-full px-3.5 py-3 text-sm sm:text-base rounded-xl border border-[#c0c2de] dark:border-[#323b63] focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-[#e2e3ef] dark:bg-[#1c223c] text-[#18192c] dark:text-[#eef0fb] placeholder-[#84869e] dark:placeholder-[#6d779f] transition-all shadow-xs touch-manipulation font-mono tracking-wider"
              placeholder={isDosenRole ? 'Misal: 1981100720081210001' : 'Misal: 1234567890'}
              autoComplete="off"
            />
          </div>

          {/* Sesi Closed Banner */}
          {!selectedSessionStatus.isOpen && (
            <div className="p-3 bg-[rgba(0,17,254,0.08)] dark:bg-blue-950/40 border border-[rgba(0,17,254,0.25)] dark:border-blue-800/40 rounded-xl text-[#060e7b] dark:text-blue-200 text-xs flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0 text-[#0467ff] dark:text-blue-400" />
              <span>
                Absensi saat ini ditutup. ({selectedSessionStatus.message})
              </span>
            </div>
          )}

          {/* Submit / Action Button */}
          <button
            type="submit"
            disabled={!isMounted || isLoading || !selectedSessionStatus.isOpen}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center mt-2 touch-manipulation min-h-[46px] ${!isMounted || !selectedSessionStatus.isOpen
              ? 'bg-[#dadbe6] dark:bg-[#202538] border border-[#c1c2d6] dark:border-[#313a57] text-[#6a6c85] dark:text-[#717b99] cursor-not-allowed shadow-none'
              : 'bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white shadow-md shadow-blue-500/25 cursor-pointer'
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
          <span className="text-[11px] text-[#6d709a] dark:text-[#8a92b5] font-medium text-center sm:text-left mt-0.5">
            *setelah absensi, e-sertifikat dapat diunduh melalui portal sertifikat
          </span>

          <a
            href="/sertifikat"
            className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center border border-[#a8abd7] dark:border-[#363f68] bg-[#e1e2f3] dark:bg-[#1e243d] text-[#2b2d4d] dark:text-[#c7d2fe] hover:bg-[#d6d8ee] dark:hover:bg-[#273050] active:scale-[0.98] shadow-xs"
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
            className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center gap-2 border border-[#a8abd7] dark:border-[#363f68] bg-white/70 dark:bg-[#181d33]/80 text-[#393b5a] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e243d] active:scale-[0.98] shadow-xs cursor-pointer touch-manipulation"
          >
            <Search className="w-4 h-4 text-[#0066ff] dark:text-[#60a5fa]" />
            <span>Cek Status Kehadiran Saya</span>
          </button>
        </form>
      </div>

      {/* Custom Confirm Modal — Lightweight Figma style */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-[#f8f8fc] dark:bg-[#14182b] rounded-[16px] shadow-2xl w-full max-w-[340px] sm:max-w-[350px] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header matching Figma */}
            <div className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8] px-4 pt-7 pb-6 flex flex-col items-center justify-center text-center text-white shrink-0">
              <h3 className="font-extrabold text-[22px] leading-6 text-white text-center">
                Konfirmasi Absensi
              </h3>
              <p className="font-normal text-[11px] leading-3 text-[#edeeff] text-center mt-1.5">
                Pastikan data kehadiran Anda sudah 100% benar
              </p>
            </div>
            <div className="p-[18px] flex flex-col space-y-3 text-center">
              <div className="bg-[#f2f3f6] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] rounded-[12px] p-3 text-xs text-[#5d5f7e] dark:text-[#9aa0c2] leading-relaxed">
                Absen hanya bisa dilakukan 1x per sesi dan tidak dapat diubah kembali setelah dikirim.
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={executeSubmit}
                  className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] hover:from-[#3b82f6] hover:to-[#0252cc] text-white rounded-[10px] h-[46px] font-bold text-[12px] flex items-center justify-center shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  Yakin, Kirim Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="bg-[#e2e3ef] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] text-[#6a6c85] dark:text-[#9aa0c2] hover:text-[#18192c] dark:hover:text-white rounded-[12px] h-[44px] font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer"
                >
                  Batal, Cek Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Absensi Berhasil Modal (Figma node 254:1284) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-[#f8f8fc] dark:bg-[#14182b] rounded-[16px] shadow-2xl w-full max-w-[340px] sm:max-w-[350px] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header matching Figma */}
            <div className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8] px-4 pt-7 pb-6 flex flex-col items-center justify-center text-center text-white shrink-0">
              <h3 className="font-extrabold text-[22px] leading-6 text-white text-center">
                {successModalData?.isAlreadyRecorded ? 'Sudah Tercatat Absen!' : 'Absensi Berhasil!'}
              </h3>
              <p className="font-normal text-[11px] leading-3 text-[#edeeff] text-center mt-1.5">
                {successModalData?.isAlreadyRecorded
                  ? 'Data kehadiran Anda sudah aman tersimpan'
                  : 'Kehadiran Anda telah sukses diverifikasi'}
              </p>
            </div>

            {/* Body matching Figma 254:1284 */}
            <div className="p-[18px] flex flex-col space-y-3">
              {/* Info Card */}
              <div className="bg-[#f2f3f6] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] rounded-[12px] p-3 flex flex-col space-y-2 text-xs">
                {/* Status / Peran */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                  <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                    Status / Peran
                  </span>
                  <span className="font-bold text-[10.5px] leading-tight text-[#18192c] dark:text-[#eef0fb] px-2 py-0.5 rounded-[6px] bg-[#c0c2de]/50 dark:bg-[#2b3356] border border-[#c0c2de]/70 dark:border-[#323b63] shadow-xs">
                    {successModalData?.roleLabel || getRoleLabel(successModalData?.role || role)}
                  </span>
                </div>

                {/* Nama Lengkap */}
                <div className="flex items-start justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                  <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                    Nama Lengkap
                  </span>
                  <span className="font-extrabold text-[12px] leading-tight text-[#18192c] dark:text-[#f1f3fd] text-right max-w-[65%]">
                    {successModalData?.nama}
                  </span>
                </div>

                {/* NIP / NIM */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                  <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                    {(() => {
                      const modalRole = successModalData?.role || role;
                      const isModalDosen = modalRole === 'panitia_dosen' || modalRole === 'peserta_dosen' || modalRole === 'peserta_tendik';
                      return isModalDosen ? 'NIP' : 'NIM';
                    })()}
                  </span>
                  <span className="font-mono font-bold text-[12px] leading-tight text-[#18192c] dark:text-[#f1f3fd]">
                    {successModalData?.nimNip}
                  </span>
                </div>

                {/* Status Validasi */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                  <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                    Status Validasi
                  </span>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#007a55] dark:text-[#34d399]" />
                    <span className="font-bold text-[9px] text-[#007a55] dark:text-[#34d399]">
                      Terverifikasi di Database
                    </span>
                  </div>
                </div>

                {/* Waktu Catatan */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                    Waktu Catatan
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#393b5a] dark:text-[#9aa0c2]" />
                    <span className="font-mono font-semibold text-[10.5px] text-[#393b5a] dark:text-[#cbd5e1]">
                      {successModalData?.waktu}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Klaim E-Sertifikat Sekarang */}
              {successModalData?.isEligible ? (
                <a
                  href="/sertifikat"
                  className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] hover:from-[#3b82f6] hover:to-[#0252cc] text-white rounded-[10px] h-[46px] font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Award className="w-4 h-4 flex-shrink-0" />
                  <span>Klaim E-Sertifikat Sekarang</span>
                </a>
              ) : null}

              {/* Tutup Button */}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="bg-[#e2e3ef] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] text-[#6a6c85] dark:text-[#9aa0c2] hover:text-[#18192c] dark:hover:text-white rounded-[12px] h-[44px] font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Check Attendance Status Modal (Figma node 249:143) */}
      {showCheckModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-[#f8f8fc] dark:bg-[#14182b] rounded-[16px] shadow-2xl w-full max-w-[340px] sm:max-w-[350px] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header matching Figma */}
            <div className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8] px-4 pt-7 pb-6 flex flex-col items-center justify-center text-center text-white shrink-0">
              <h3 className="font-extrabold text-[22px] leading-6 text-white text-center">
                Cek Status Absensi
              </h3>
              <p className="font-normal text-[11px] leading-3 text-[#edeeff] text-center mt-1.5">
                Periksa apakah kehadiran Anda sudah tercatat di sistem
              </p>
            </div>

            {/* Form & Results matching Figma */}
            <div className="p-[18px] flex flex-col space-y-3">
              <form onSubmit={handleCheckStatus} className="flex flex-col space-y-1.5">
                <label className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                  Masukkan NIM / NIP
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    required
                    value={checkNimNip}
                    onChange={(e) => setCheckNimNip(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234567891023456789"
                    className="flex-1 h-[44px] px-3 text-sm rounded-[12px] border border-[#c0c2de] dark:border-[#323b63] bg-[#e2e3ef] dark:bg-[#1c223c] text-[#18192c] dark:text-[#eef0fb] placeholder-[#84869e] dark:placeholder-[#6d779f] font-mono focus:ring-2 focus:ring-[#0066ff]/30"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={isCheckingStatus || !checkNimNip.trim()}
                    className="h-[44px] px-4 rounded-[12px] bg-gradient-to-r from-[#4c95e6] to-[#0467ff] hover:from-[#3b82f6] hover:to-[#0252cc] text-white font-bold text-[11px] flex items-center justify-center whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Cek'
                    )}
                  </button>
                </div>
              </form>

              {/* Result Area matching the clean info card */}
              {checkResult && (
                <div className="animate-in fade-in duration-150">
                  {checkResult.found ? (
                    <div className="space-y-3">
                      <div className="bg-[#f2f3f6] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] rounded-[12px] p-3 flex flex-col space-y-2 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                          <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                            Status / Peran
                          </span>
                          <span className="font-bold text-[10.5px] leading-tight text-[#18192c] dark:text-[#eef0fb] px-2 py-0.5 rounded-[6px] bg-[#c0c2de]/50 dark:bg-[#2b3356] border border-[#c0c2de]/70 dark:border-[#323b63]">
                            {getRoleLabel(checkResult.role)}
                          </span>
                        </div>

                        <div className="flex items-start justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                          <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                            Nama Lengkap
                          </span>
                          <span className="font-extrabold text-[12px] leading-tight text-[#18192c] dark:text-[#f1f3fd] text-right max-w-[65%]">
                            {checkResult.nama}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                          <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                            NIM/NIP
                          </span>
                          <span className="font-mono font-bold text-[12px] leading-tight text-[#18192c] dark:text-[#f1f3fd]">
                            {checkResult.nim_nip}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pb-1.5 border-b border-[#c0c2de]/60 dark:border-[#323b63]/60">
                          <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                            Status Validasi
                          </span>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#007a55] dark:text-[#34d399]" />
                            <span className="font-bold text-[9px] text-[#007a55] dark:text-[#34d399]">
                              {checkResult.hasPagi || checkResult.hasSiang ? 'Terverifikasi di Database' : 'Belum Absen'}
                            </span>
                          </div>
                        </div>

                        {(checkResult.pagiWaktu || checkResult.siangWaktu) && (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[9px] uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
                              Waktu Catatan
                            </span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#393b5a] dark:text-[#9aa0c2]" />
                              <span className="font-mono font-semibold text-[10.5px] text-[#393b5a] dark:text-[#cbd5e1]">
                                {checkResult.pagiWaktu || checkResult.siangWaktu}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {checkResult.eligibleForCertificate && (
                        <a
                          href="/sertifikat"
                          className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] hover:from-[#3b82f6] hover:to-[#0252cc] text-white rounded-[10px] h-[46px] font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Award className="w-4 h-4 flex-shrink-0" />
                          <span>Klaim E-Sertifikat Sekarang</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-[12px] text-xs text-rose-900 dark:text-rose-200 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                      <span>{checkResult.message || 'Belum ada data absensi untuk NIM/NIP tersebut.'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tutup Button */}
              <button
                type="button"
                onClick={() => {
                  setShowCheckModal(false);
                  setCheckResult(null);
                }}
                className="bg-[#e2e3ef] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] text-[#6a6c85] dark:text-[#9aa0c2] hover:text-[#18192c] dark:hover:text-white rounded-[12px] h-[44px] font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer"
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
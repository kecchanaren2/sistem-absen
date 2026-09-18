'use client';

import { useState, useEffect, useRef } from 'react';
import fpPromise from '@fingerprintjs/fingerprintjs';
import { 
  ChevronDown, 
  MapPin, 
  Smartphone,
  Loader2, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Lock, 
  UserCheck, 
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import { getSessionStatus, SESSION_SCHEDULES, SessionStatus } from '@/lib/schedule';

export default function AttendanceForm() {
  const [email, setEmail] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [role, setRole] = useState<'panitia_mahasiswa' | 'panitia_dosen' | 'peserta_mahasiswa' | 'peserta_tendik' | 'peserta_dosen'>('peserta_mahasiswa');
  const [nimNip, setNimNip] = useState('');
  const [hariAbsen, setHariAbsen] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);

  // Realtime Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // Theme state (Dark / Light mode)
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState(false);

  // States for indicators
  const [locationStatus, setLocationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [fpStatus, setFpStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [roleOpen, setRoleOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const [visitorId, setVisitorId] = useState<string | null>(null);

  // Schedules state
  const [status1, setStatus1] = useState<SessionStatus>(() => getSessionStatus(1));
  const [status2, setStatus2] = useState<SessionStatus>(() => getSessionStatus(2));

  // Initialize theme
  useEffect(() => {
    setIsMounted(true);
    const isDarkCurrent = document.documentElement.classList.contains('dark');
    setIsDark(isDarkCurrent);
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
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const s1 = getSessionStatus(1, now);
      const s2 = getSessionStatus(2, now);
      setStatus1(s1);
      setStatus2(s2);
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto select open session
    if (!status1.isOpen && status2.isOpen) {
      setHariAbsen(2);
    } else if (status1.isOpen && !status2.isOpen) {
      setHariAbsen(1);
    }
  }, [status1.isOpen, status2.isOpen]);

  useEffect(() => {
    // Initialize FingerprintJS
    const getFingerprint = async () => {
      try {
        const fp = await fpPromise.load();
        const result = await fp.get();
        setVisitorId(result.visitorId);
        setFpStatus('success');
      } catch (error) {
        console.error('Failed to get fingerprint', error);
        setFpStatus('error');
      }
    };

    getFingerprint();
  }, []);

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

  const getLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser Anda'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      }
    });
  };

  const selectedSessionStatus = hariAbsen === 1 ? status1 : status2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Validation for NIM / NIP format
    const cleanNimNip = nimNip.trim();
    const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';
    if (isDosenRole) {
      if (!/^\d{18}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIP harus berupa 18 digit angka.', type: 'error' });
        setIsLoading(false);
        return;
      }
    } else {
      if (!/^\d{10}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIM harus berupa 10 digit angka.', type: 'error' });
        setIsLoading(false);
        return;
      }
    }

    try {
      if (!selectedSessionStatus.isOpen) {
        throw new Error(`Sesi ${SESSION_SCHEDULES[hariAbsen].name} sedang ditutup.`);
      }

      if (!visitorId) {
        throw new Error('Identifikasi perangkat belum siap. Silakan refresh halaman.');
      }

      // 1. Get Geolocation
      let position: GeolocationPosition;
      setLocationStatus('pending');
      try {
        position = await getLocation();
        setLocationStatus('success');
      } catch (error: any) {
        setLocationStatus('error');
        throw new Error(
          error.message === 'User denied Geolocation'
            ? 'Mohon izinkan akses lokasi untuk melakukan absensi.'
            : 'Gagal mendapatkan lokasi. Pastikan GPS aktif.'
        );
      }

      // 2. Get Local Token
      const localToken = localStorage.getItem('absen_local_token') || '';

      // 3. Submit to API
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
          visitor_id: visitorId,
          local_token: localToken,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      // Save token if new
      if (data.local_token && !localToken) {
        localStorage.setItem('absen_local_token', data.local_token);
      }

      setMessage({ text: data.message, type: 'success' });
      setEligibleForCertificate(data.eligibleForCertificate);
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (namaPeserta) {
      try {
        const { generateAndDownloadCertificate } = await import('@/lib/certificate');
        await generateAndDownloadCertificate(namaPeserta, role);
      } catch (error) {
        console.error("Gagal membuat sertifikat:", error);
        alert("Gagal membuat sertifikat pada perangkat ini.");
      }
    }
  };

  const ROLES = [
    { value: 'panitia_mahasiswa', label: 'Panitia Mahasiswa', group: 'Panitia' },
    { value: 'panitia_dosen', label: 'Panitia Dosen', group: 'Panitia' },
    { value: 'peserta_mahasiswa', label: 'Peserta Mahasiswa', group: 'Peserta' },
    { value: 'peserta_tendik', label: 'Peserta Tendik', group: 'Peserta' },
    { value: 'peserta_dosen', label: 'Peserta Dosen', group: 'Peserta' },
  ] as const;

  const selectedRole = ROLES.find((r) => r.value === role) || ROLES[2];
  const isDosenRole = role === 'panitia_dosen' || role === 'peserta_dosen' || role === 'peserta_tendik';

  return (
    <div className="w-full max-w-md sm:max-w-lg mx-auto flex flex-col bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl shadow-2xl overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] transition-all duration-300">
      {/* Header Banner with Exact Figma Gradient and Vector Iconography */}
      <div 
        className="relative px-6 sm:px-8 pt-8 pb-9 text-white text-center flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(156.67deg, rgb(218, 60, 46) 0%, rgb(246, 207, 47) 100%)'
        }}
      >
        {/* Dies Iconograph Vector Background Overlay */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[576px] left-1/2 top-1/2 w-[487px] pointer-events-none opacity-85 mix-blend-screen select-none">
          <img
            alt=""
            src="/dies-iconograph.svg"
            className="absolute block inset-0 max-w-none size-full object-contain"
          />
        </div>

        {/* Ambient Blur Lights */}
        <div className="absolute bg-white/10 blur-[40px] -right-8 -top-8 rounded-full size-32 pointer-events-none" />
        <div className="absolute bg-[#ffee7c]/20 blur-[40px] -left-8 -bottom-8 rounded-full size-32 pointer-events-none" />

        {/* Top Header Actions */}
        {isMounted && (
          <>
            {/* Certificate Portal Button on the top left */}
            <a
              href="/sertifikat"
              className="absolute top-4 left-4 z-20 px-4 py-1.5 rounded-full bg-[#3e2a21]/90 hover:bg-[#3e2a21] border border-white/10 text-white/90 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-sm"
            >
              Sertifikat
            </a>
            
            {/* Theme Toggle Button on the top right */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Dark / Light Mode"
              className="absolute top-4 right-4 z-20 !min-h-0 !min-w-0 p-[5px] rounded-full backdrop-blur-[12px] bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-200 active:scale-90 shadow-sm flex items-center justify-center"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-yellow-100 transition-transform duration-300 rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-white transition-transform duration-300 rotate-0 hover:-rotate-12" />
              )}
            </button>
          </>
        )}

        {/* Frosted Logo Banner Capsule */}
        <div className="relative z-10 backdrop-blur-[12px] bg-white/35 border border-white/40 flex items-center justify-center gap-3.5 px-5 py-2 rounded-[22px] mb-4 shadow-sm">
          {/* Logo UNUD */}
          <img
            src="/logo unud 1.svg"
            alt="Logo Universitas Udayana"
            className="h-9 w-auto object-contain"
          />
          {/* Logo Kampus Merdeka */}
          <img
            src="/Logo_Kampus_Merdeka_Kemendikbud 3.svg"
            alt="Logo Kampus Merdeka"
            className="h-8 w-auto object-contain"
          />
          {/* Logo Dies Natalis */}
          <img
            src="/logo-dies-hitam.svg"
            alt="Logo Dies Natalis"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Main Title */}
        <h2 className="relative z-10 text-3xl sm:text-4xl font-extrabold tracking-[-0.75px] text-white drop-shadow-sm mb-2 leading-none">
          PORTAL ABSENSI
        </h2>

        {/* Live Clock Server Time Badge */}
        {currentTime && (
          <div className="relative z-10 mt-1 flex items-center space-x-1.5 backdrop-blur-[12px] bg-black/25 dark:bg-black/35 px-3.5 py-1 rounded-full text-xs text-orange-50 font-mono border border-white/20 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-yellow-200" />
            <span>Waktu Server: {currentTime} WITA</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 flex flex-col space-y-5">
        {/* Real-time Hardware & Geo Verification Status */}
        <div className="flex flex-row items-center justify-around py-1 px-2">
          {/* GPS Location Status */}
          <div className="flex flex-1 flex-col items-center justify-center space-y-1">
            {locationStatus === 'pending' ? (
              <MapPin className="text-amber-500 animate-bounce w-5 h-5" />
            ) : locationStatus === 'success' ? (
              <MapPin className="text-emerald-500 w-5 h-5" />
            ) : (
              <AlertCircle className="text-rose-500 w-5 h-5" />
            )}
            <span className="text-xs font-semibold text-[#5a4439] dark:text-[#d1bfb5]">
              Lokasi GPS
            </span>
            <span className="text-[11px] text-[#8c776c] dark:text-[#a8968c] font-medium">
              {locationStatus === 'success' ? 'Terverifikasi ✓' : locationStatus === 'error' ? 'Gagal ✗' : 'Siap'}
            </span>
          </div>

          {/* Device Verification Status */}
          <div className="flex flex-1 flex-col items-center justify-center space-y-1">
            {fpStatus === 'pending' ? (
              <Smartphone className="text-amber-500 animate-pulse w-5 h-5" />
            ) : fpStatus === 'success' ? (
              <Smartphone className="text-emerald-500 w-5 h-5" />
            ) : (
              <AlertCircle className="text-rose-500 w-5 h-5" />
            )}
            <span className="text-xs font-semibold text-[#5a4439] dark:text-[#d1bfb5]">
              Perangkat
            </span>
            <span className="text-[11px] text-[#8c776c] dark:text-[#a8968c] font-medium">
              {fpStatus === 'success' ? 'Terverifikasi ✓' : fpStatus === 'error' ? 'Gagal ✗' : 'Memeriksa...'}
            </span>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {message && (
          <div
            className={`p-4 rounded-2xl flex items-start space-x-3 text-sm transition-all duration-300 ${
              message.type === 'success'
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
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#3d2417] dark:text-orange-100 mb-1">
              Selamat! Anda Berhak E-Sertifikat 🎉
            </h3>
            <p className="text-[#69422f] dark:text-orange-300 text-xs mb-4 leading-relaxed">
              Seluruh sesi absensi Anda telah tercatat dengan valid.
            </p>
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-orange-500/20 touch-manipulation"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Sertifikat</span>
            </button>
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
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all touch-manipulation active:scale-[0.99] bg-[#efe7e2] dark:bg-[#34241d] shadow-xs ${
                  roleOpen
                    ? 'border-orange-500 ring-2 ring-orange-500/20 text-[#2c1e18] dark:text-[#f5ece7] dark:border-orange-500'
                    : 'border-[#decbc0] dark:border-[#4f382c] text-[#2c1e18] dark:text-[#f5ece7] hover:border-orange-400 dark:hover:border-orange-500'
                }`}
              >
                <span className="flex items-center space-x-2.5">
                  <UserCheck className="w-4 h-4 flex-shrink-0 text-orange-500" />
                  <span>{selectedRole.label}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#8f7d73] dark:text-[#a39086] transition-transform duration-200 ${
                    roleOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown panel */}
              {roleOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border border-[#decbc0] dark:border-[#4f382c] bg-[#fcfaf8] dark:bg-[#2b1c16] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Panitia group */}
                  <div className="px-3 pt-2.5 pb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#9d8a80] dark:text-[#8f7e75]">
                      Panitia
                    </span>
                  </div>
                  {ROLES.filter((r) => r.group === 'Panitia').map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        setRole(r.value);
                        setMessage(null);
                        setRoleOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold transition-colors touch-manipulation active:scale-[0.99] ${
                        role === r.value
                          ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold'
                          : 'text-[#3d2b22] dark:text-[#e5d8d0] hover:bg-[#efe7e2] dark:hover:bg-[#38261e]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          role === r.value ? 'bg-orange-500' : 'bg-[#decbc0] dark:bg-[#4f382c]'
                        }`}
                      />
                      <span>{r.label}</span>
                      {role === r.value && <span className="ml-auto text-orange-500">✓</span>}
                    </button>
                  ))}
                  {/* Peserta group */}
                  <div className="px-3 pt-3 pb-1 border-t border-[#decbc0]/60 dark:border-[#4f382c]/60 mt-1">
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
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold transition-colors touch-manipulation active:scale-[0.99] ${
                        role === r.value
                          ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold'
                          : 'text-[#3d2b22] dark:text-[#e5d8d0] hover:bg-[#efe7e2] dark:hover:bg-[#38261e]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          role === r.value ? 'bg-orange-500' : 'bg-[#decbc0] dark:bg-[#4f382c]'
                        }`}
                      />
                      <span>{r.label}</span>
                      {role === r.value && <span className="ml-auto text-orange-500">✓</span>}
                    </button>
                  ))}
                  <div className="h-1.5" />
                </div>
              )}
            </div>
          </div>

          {/* Nama Lengkap Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              NAMA LENGKAP
            </label>
            <input
              type="text"
              required
              value={namaPeserta}
              onChange={(e) => setNamaPeserta(e.target.value)}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation"
              placeholder="Masukkan nama sesuai identitas"
              autoComplete="name"
            />
          </div>

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
              maxLength={isDosenRole ? 18 : 10}
              value={nimNip}
              onChange={(e) => {
                setNimNip(e.target.value.replace(/\D/g, ''));
              }}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation font-mono tracking-wider"
              placeholder={isDosenRole ? 'Misal: 198110072008121000' : 'Misal: 1234567890'}
              autoComplete="off"
            />
          </div>

          {/* Sesi Absensi Selection */}
          <div className="flex flex-col space-y-2 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              SESI ABSENSI
            </label>
            <div className="flex flex-row gap-2.5 sm:gap-3 w-full">
              {/* Sesi Pagi */}
              <button
                type="button"
                onClick={() => setHariAbsen(1)}
                className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98] ${
                  hariAbsen === 1
                    ? 'border-orange-500 bg-[#f87158] dark:bg-[#532616] text-white shadow-md ring-2 ring-orange-500/25'
                    : 'border-[#decbc0] dark:border-[#4f382c] bg-[#efe7e2] dark:bg-[#34241d] text-[#5a4439] dark:text-[#c9b8ae] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23]'
                } ${!status1.isOpen ? 'opacity-85' : 'cursor-pointer'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="text-base font-extrabold">Pagi</span>
                  {!status1.isOpen && <Lock className="w-3.5 h-3.5 opacity-70" />}
                </div>
                <div className="flex items-center text-[11px] space-x-1 font-medium opacity-85">
                  <Clock className="w-3 h-3" />
                  <span>
                    {SESSION_SCHEDULES[1].startTime} - {SESSION_SCHEDULES[1].endTime}
                  </span>
                </div>
                <span
                  className={`mt-2 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold tracking-wide ${
                    status1.isOpen
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      : hariAbsen === 1
                      ? 'bg-black/20 text-white border border-white/20'
                      : 'bg-[#d8c3b7] dark:bg-[#442f25] text-[#5e473b] dark:text-[#c2afa4]'
                  }`}
                >
                  {status1.isOpen ? 'BUKA' : status1.message}
                </span>
              </button>

              {/* Sesi Siang */}
              <button
                type="button"
                onClick={() => setHariAbsen(2)}
                className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98] ${
                  hariAbsen === 2
                    ? 'border-orange-500 bg-[#f87158] dark:bg-[#532616] text-white shadow-md ring-2 ring-orange-500/25'
                    : 'border-[#decbc0] dark:border-[#4f382c] bg-[#efe7e2] dark:bg-[#34241d] text-[#5a4439] dark:text-[#c9b8ae] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23]'
                } ${!status2.isOpen ? 'opacity-85' : 'cursor-pointer'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="text-base font-extrabold">Siang</span>
                  {!status2.isOpen && <Lock className="w-3.5 h-3.5 opacity-70" />}
                </div>
                <div className="flex items-center text-[11px] space-x-1 font-medium opacity-85">
                  <Clock className="w-3 h-3" />
                  <span>
                    {SESSION_SCHEDULES[2].startTime} - {SESSION_SCHEDULES[2].endTime}
                  </span>
                </div>
                <span
                  className={`mt-2 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold tracking-wide ${
                    status2.isOpen
                      ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      : hariAbsen === 2
                      ? 'bg-black/20 text-white border border-white/20'
                      : 'bg-[#d8c3b7] dark:bg-[#442f25] text-[#5e473b] dark:text-[#c2afa4]'
                  }`}
                >
                  {status2.isOpen ? 'BUKA' : status2.message}
                </span>
              </button>
            </div>
          </div>

          {/* Sesi Closed Banner */}
          {!selectedSessionStatus.isOpen && (
            <div className="p-3 bg-amber-500/10 dark:bg-[#382012] border border-amber-500/30 dark:border-[#6b3816] rounded-xl text-amber-900 dark:text-[#fcd34d] text-xs flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Sesi {SESSION_SCHEDULES[hariAbsen].name} saat ini ditutup. ({selectedSessionStatus.message})
              </span>
            </div>
          )}

          {/* Submit / Action Button */}
          <button
            type="submit"
            disabled={isLoading || fpStatus !== 'success' || !selectedSessionStatus.isOpen}
            className={`w-full py-4 px-4 rounded-2xl font-bold text-base sm:text-lg transition-all flex justify-center items-center mt-3 touch-manipulation min-h-[52px] ${
              !selectedSessionStatus.isOpen
                ? 'bg-[#e6dcda] dark:bg-[#38261e] border border-[#d6c7c1] dark:border-[#4a3429] text-[#85726a] dark:text-[#8e786d] cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] active:scale-[0.98] text-white shadow-lg shadow-orange-500/25 cursor-pointer'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                <span>Memproses Absensi...</span>
              </>
            ) : fpStatus !== 'success' ? (
              <span>Menyiapkan Verifikasi...</span>
            ) : !selectedSessionStatus.isOpen ? (
              <span>Sesi Ditutup</span>
            ) : (
              <span>Absen Sekarang</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import fpPromise from '@fingerprintjs/fingerprintjs';
import { MapPin, Fingerprint, Loader2, Download, CheckCircle, AlertCircle, Clock, Lock, UserCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { getSessionStatus, SESSION_SCHEDULES, SessionStatus } from '@/lib/schedule';

export default function AttendanceForm() {
  const [email, setEmail] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [role, setRole] = useState<'mahasiswa' | 'dosen'>('mahasiswa');
  const [nimNip, setNimNip] = useState('');
  const [hariAbsen, setHariAbsen] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);
  
  // Realtime Clock
  const [currentTime, setCurrentTime] = useState<string>('');

  // States for indicators
  const [locationStatus, setLocationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [fpStatus, setFpStatus] = useState<'pending' | 'success' | 'error'>('pending');

  const [visitorId, setVisitorId] = useState<string | null>(null);

  // Schedules state
  const [status1, setStatus1] = useState<SessionStatus>(() => getSessionStatus(1));
  const [status2, setStatus2] = useState<SessionStatus>(() => getSessionStatus(2));

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

  const getLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
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
    if (role === 'mahasiswa') {
      if (!/^\d{10}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIM harus berupa 10 digit angka.', type: 'error' });
        setIsLoading(false);
        return;
      }
    } else if (role === 'dosen') {
      if (!/^\d{12}$/.test(cleanNimNip)) {
        setMessage({ text: 'NIP harus berupa 12 digit angka.', type: 'error' });
        setIsLoading(false);
        return;
      }
    }

    setLocationStatus('pending');

    try {
      if (!selectedSessionStatus.isOpen) {
        throw new Error(`Sesi ${SESSION_SCHEDULES[hariAbsen].name} sedang ditutup.`);
      }

      if (!visitorId) {
        throw new Error('Identifikasi perangkat belum siap. Silakan refresh halaman.');
      }

      // 1. Get Geolocation
      let position: GeolocationPosition;
      try {
        position = await getLocation();
        setLocationStatus('success');
      } catch (error: any) {
        setLocationStatus('error');
        throw new Error(error.message === 'User denied Geolocation' 
          ? 'Mohon izinkan akses lokasi untuk melakukan absensi.' 
          : 'Gagal mendapatkan lokasi. Pastikan GPS aktif.');
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

  const handleDownloadCertificate = () => {
    window.open(`/api/certificate?nama_peserta=${encodeURIComponent(namaPeserta)}`, '_blank');
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg mx-auto flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80 transition-all">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-5 sm:px-8 py-7 sm:py-9 text-white text-center flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide text-blue-50 mb-3 border border-white/20">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
          <span>Sistem Presensi Resmi</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Portal Absensi</h2>

        {/* Live Clock Badge */}
        {currentTime && (
          <div className="mt-3.5 flex items-center space-x-1.5 bg-black/25 backdrop-blur-md px-3 py-1 rounded-full text-xs text-blue-100 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span>Waktu Server: {currentTime} WIB</span>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-8 flex flex-col space-y-5">
        {/* Real-time Hardware & Geo Verification Badges */}
        <div className="flex flex-row items-center justify-around gap-2.5 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/50">
          <div className="flex flex-1 flex-col items-center justify-center space-y-1 p-2 rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800">
            {locationStatus === 'pending' ? <MapPin className="text-amber-500 animate-bounce w-5 h-5" /> : 
             locationStatus === 'success' ? <MapPin className="text-emerald-500 w-5 h-5" /> : 
             <AlertCircle className="text-rose-500 w-5 h-5" />}
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Lokasi GPS</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {locationStatus === 'success' ? 'Terverifikasi ✓' : locationStatus === 'error' ? 'Gagal ✗' : 'Siap'}
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center space-y-1 p-2 rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800">
            {fpStatus === 'pending' ? <Fingerprint className="text-amber-500 animate-spin w-5 h-5" /> : 
             fpStatus === 'success' ? <Fingerprint className="text-emerald-500 w-5 h-5" /> : 
             <AlertCircle className="text-rose-500 w-5 h-5" />}
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Perangkat</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {fpStatus === 'success' ? 'Terverifikasi ✓' : fpStatus === 'error' ? 'Gagal ✗' : 'Memeriksa...'}
            </span>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {message && (
          <div className={`p-4 rounded-2xl flex items-start space-x-3 text-sm transition-all duration-300 ${
            message.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 shadow-sm' 
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800/60 shadow-sm'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />}
            <span className="font-medium leading-relaxed">{message.text}</span>
          </div>
        )}

        {/* Certificate Card */}
        {eligibleForCertificate && (
          <div className="p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 dark:from-indigo-950/40 dark:via-blue-950/40 dark:to-purple-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 text-center shadow-md">
            <div className="inline-flex p-2 bg-indigo-100 dark:bg-indigo-900/60 rounded-full mb-2 text-indigo-600 dark:text-indigo-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-indigo-950 dark:text-indigo-100 mb-1">Selamat! Anda Berhak E-Sertifikat 🎉</h3>
            <p className="text-indigo-800 dark:text-indigo-300 text-xs mb-4 leading-relaxed">
              Seluruh sesi absensi Anda telah tercatat dengan valid.
            </p>
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 touch-manipulation"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Sertifikat</span>
            </button>
          </div>
        )}

        {/* Main Attendance Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {/* Status / Peran Selection */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Status / Peran
            </label>
            <div className="flex flex-row gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setRole('mahasiswa');
                  setMessage(null);
                }}
                className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border touch-manipulation active:scale-[0.98] ${
                  role === 'mahasiswa'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <span>Mahasiswa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('dosen');
                  setMessage(null);
                }}
                className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border touch-manipulation active:scale-[0.98] ${
                  role === 'dosen'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                }`}
              >
                <UserCheck className="w-4 h-4 flex-shrink-0" />
                <span>Dosen</span>
              </button>
            </div>
          </div>

          {/* Nama Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={namaPeserta}
              onChange={(e) => setNamaPeserta(e.target.value)}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-all shadow-sm touch-manipulation"
              placeholder="Masukkan nama sesuai identitas"
              autoComplete="name"
            />
          </div>

          {/* Email Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-all shadow-sm touch-manipulation"
              placeholder="email@contoh.com"
              autoComplete="email"
            />
          </div>

          {/* NIM / NIP Input */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex flex-row justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {role === 'mahasiswa' ? 'NIM (Mahasiswa)' : 'NIP (Dosen)'}
              </label>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {role === 'mahasiswa' ? '10 Digit Angka' : '12 Digit Angka'}
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={role === 'mahasiswa' ? 10 : 12}
              value={nimNip}
              onChange={(e) => setNimNip(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white transition-all shadow-sm touch-manipulation font-mono tracking-wider"
              placeholder={role === 'mahasiswa' ? 'Misal: 1234567890 (10 digit)' : 'Misal: 123456789012 (12 digit)'}
              autoComplete="off"
            />
          </div>

          {/* Sesi Absensi Selection */}
          <div className="flex flex-col space-y-2 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Sesi Absensi
            </label>
            <div className="flex flex-row gap-2.5 sm:gap-3 w-full">
              {/* Sesi Pagi */}
              <button
                type="button"
                onClick={() => setHariAbsen(1)}
                className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98] ${
                  hariAbsen === 1
                    ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-md ring-2 ring-blue-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                } ${!status1.isOpen ? 'opacity-70' : 'cursor-pointer'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="text-base font-extrabold">Pagi</span>
                  {!status1.isOpen && <Lock className="w-3.5 h-3.5 text-zinc-400" />}
                </div>
                <div className="flex items-center text-[11px] space-x-1 font-medium opacity-80">
                  <Clock className="w-3 h-3" />
                  <span>{SESSION_SCHEDULES[1].startTime} - {SESSION_SCHEDULES[1].endTime}</span>
                </div>
                <span className={`mt-2 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold tracking-wide ${
                  status1.isOpen 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                }`}>
                  {status1.isOpen ? 'BUKA' : status1.message}
                </span>
              </button>

              {/* Sesi Siang */}
              <button
                type="button"
                onClick={() => setHariAbsen(2)}
                className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98] ${
                  hariAbsen === 2
                    ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-md ring-2 ring-blue-500/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                } ${!status2.isOpen ? 'opacity-70' : 'cursor-pointer'}`}
              >
                <div className="flex items-center space-x-1.5 mb-1">
                  <span className="text-base font-extrabold">Siang</span>
                  {!status2.isOpen && <Lock className="w-3.5 h-3.5 text-zinc-400" />}
                </div>
                <div className="flex items-center text-[11px] space-x-1 font-medium opacity-80">
                  <Clock className="w-3 h-3" />
                  <span>{SESSION_SCHEDULES[2].startTime} - {SESSION_SCHEDULES[2].endTime}</span>
                </div>
                <span className={`mt-2 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-bold tracking-wide ${
                  status2.isOpen 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                }`}>
                  {status2.isOpen ? 'BUKA' : status2.message}
                </span>
              </button>
            </div>
          </div>

          {!selectedSessionStatus.isOpen && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-center space-x-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>Sesi {SESSION_SCHEDULES[hariAbsen].name} saat ini ditutup. ({selectedSessionStatus.message})</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || fpStatus !== 'success' || !selectedSessionStatus.isOpen}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:from-zinc-400 disabled:to-zinc-400 dark:disabled:from-zinc-700 dark:disabled:to-zinc-700 disabled:cursor-not-allowed text-white py-4 px-4 rounded-2xl font-bold text-base sm:text-lg shadow-lg shadow-blue-500/25 transition-all flex justify-center items-center mt-3 touch-manipulation min-h-[52px]"
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




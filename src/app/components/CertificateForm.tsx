'use client';

import { useState, useEffect } from 'react';
import { 
  Loader2, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import Link from 'next/link';

export default function CertificateForm() {
  const [nimNip, setNimNip] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);
  const [namaPeserta, setNamaPeserta] = useState('');

  const [rolePeserta, setRolePeserta] = useState('');

  // Theme state (Dark / Light mode)
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setEligibleForCertificate(false);
    setNamaPeserta('');
    setRolePeserta('');

    const cleanNimNip = nimNip.trim();

    if (!cleanNimNip) {
      setMessage({ text: 'NIM/NIP wajib diisi.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/certificate/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nim_nip: cleanNimNip,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat memverifikasi.');
      }

      setMessage({ text: data.message, type: 'success' });
      setEligibleForCertificate(data.eligible);
      if (data.nama_peserta) {
        setNamaPeserta(data.nama_peserta);
      }
      if (data.role) {
        setRolePeserta(data.role);
      }
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
        await generateAndDownloadCertificate(namaPeserta, rolePeserta);
      } catch (error) {
        console.error("Gagal membuat sertifikat:", error);
        alert("Gagal membuat sertifikat pada perangkat ini.");
      }
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-lg mx-auto flex flex-col bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl shadow-2xl overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] transition-all duration-300">
      {/* Header Banner */}
      <div 
        className="relative px-6 sm:px-8 pt-8 pb-9 text-white text-center flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(156.67deg, rgb(218, 60, 46) 0%, rgb(246, 207, 47) 100%)'
        }}
      >
        {/* Vector Background Overlay */}
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

        {/* Top Header Actions (Theme Toggle Button on the top left) */}
        {isMounted && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Dark / Light Mode"
            className="absolute top-4 left-4 z-20 !min-h-0 !min-w-0 p-[5px] rounded-full backdrop-blur-[12px] bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-200 active:scale-90 shadow-sm flex items-center justify-center"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-yellow-100 transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-white transition-transform duration-300 rotate-0 hover:-rotate-12" />
            )}
          </button>
        )}
        
        {/* Back to Portal Absensi button on top right */}
        {isMounted && (
          <Link
            href="/"
            className="absolute top-4 right-4 z-20 px-4 py-1.5 rounded-full backdrop-blur-[12px] bg-black/40 hover:bg-black/60 border border-white/20 text-white/90 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-sm"
          >
            Absensi
          </Link>
        )}

        {/* Frosted Logo Banner Capsule */}
        <div className="relative z-10 backdrop-blur-[12px] bg-white/35 border border-white/40 flex items-center justify-center gap-3.5 px-5 py-2 rounded-[22px] mb-4 shadow-sm mt-4">
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
          PORTAL SERTIFIKAT
        </h2>
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 flex flex-col space-y-6">
        
        <div>
          <h3 className="text-[17px] font-bold text-[#2c1e18] dark:text-[#f5ece7] mb-1.5">
            Masukkan Identitas Presensi Anda
          </h3>
          <p className="text-sm text-[#7e695d] dark:text-[#a39086] leading-relaxed">
            Gunakan <strong className="font-semibold text-[#5a4439] dark:text-[#c9b8ae]">NIM</strong> (untuk Mahasiswa) atau <strong className="font-semibold text-[#5a4439] dark:text-[#c9b8ae]">NIP</strong> (untuk Dosen/Tendik/Umum) yang Anda input saat mengisi formulir presensi kegiatan.
          </p>
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

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
          
          {/* NIM / NIP Input */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              NIM/NIP
            </label>
            <input
              type="text"
              required
              value={nimNip}
              onChange={(e) => {
                setNimNip(e.target.value.replace(/\D/g, ''));
              }}
              className="w-full px-4 py-3.5 text-sm sm:text-base rounded-xl border border-[#decbc0] dark:border-[#4f382c] focus:ring-2 focus:ring-[#04b077] focus:border-[#04b077] bg-[#efe7e2] dark:bg-[#34241d] text-[#2c1e18] dark:text-[#f5ece7] placeholder-[#9e8e84] dark:placeholder-[#8c776c] transition-all shadow-xs touch-manipulation font-mono tracking-wider"
              placeholder="Misal: 123456789"
              autoComplete="off"
            />
          </div>

          {/* Submit / Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-base transition-all flex justify-center items-center touch-manipulation bg-[#04b077] hover:bg-[#039967] active:scale-[0.98] text-white shadow-md shadow-[#04b077]/20"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Verifikasi</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

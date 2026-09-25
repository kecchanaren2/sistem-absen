'use client';

import { useState } from 'react';
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
      setMessage({ text: 'NIP wajib diisi.', type: 'error' });
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memverifikasi.';
      setMessage({ text: errorMessage, type: 'error' });
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
    <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-[760px] mx-auto flex flex-col bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl sm:rounded-[28px] md:rounded-[32px] shadow-2xl overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] transition-all duration-300">
      {/* Header Banner */}
      <div
        className="relative px-6 sm:px-8 md:px-10 pt-8 sm:pt-9 md:pt-10 pb-9 sm:pb-10 md:pb-11 text-white text-center flex flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(156.67deg, rgb(218, 60, 46) 0%, rgb(246, 207, 47) 100%)'
        }}
      >
        {/* Vector Background Overlay */}
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

        {/* Top Header Actions (Theme Toggle Button on the top left) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle Dark / Light Mode"
          className="absolute top-4 left-4 z-20 !min-h-0 !min-w-0 p-[5px] sm:p-1.5 rounded-full backdrop-blur-[12px] bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-200 active:scale-90 shadow-sm flex items-center justify-center"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-yellow-100 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-white transition-transform duration-300 rotate-0 hover:-rotate-12" />
          )}
        </button>

        {/* Frosted Logo Banner Capsule */}
        <div className="relative z-10 backdrop-blur-[12px] bg-white/35 border border-white/40 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 md:gap-4 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-[22px] md:rounded-[24px] mb-4 md:mb-5 shadow-sm mt-4">
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
          PORTAL SERTIFIKAT
        </h2>
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 md:p-9 flex flex-col space-y-6">

        <div>
          <h3 className="text-[17px] font-bold text-[#2c1e18] dark:text-[#f5ece7] mb-1.5">
            Masukkan NIP Anda
          </h3>
          <p className="text-sm text-[#7e695d] dark:text-[#a39086] leading-relaxed">
            Gunakan <strong className="font-semibold text-[#5a4439] dark:text-[#c9b8ae]">NIP</strong> yang Anda input saat mengisi formulir presensi kegiatan.
          </p>
        </div>

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

          {/* NIP Input */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#7e695d] dark:text-[#b09d92]">
              NIP
            </label>
            <input
              type="text"
              required
              value={nimNip}
              maxLength={19}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/\D/g, '').slice(0, 19);
                setNimNip(numericValue);
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
          <span className="text-[11px] text-[#9a7d6d] dark:text-[#c4a492] font-medium italic mt-0.5">
            *lakukan absensi terlebih dahulu supaya e-sertifikat dapat diproses
            <br />
            e-sertifikat akan dikirim ke email yang terdaftar saat absensi
          </span>
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center border border-[#d7bca8] dark:border-[#4f382c] bg-[#f3e7e1] dark:bg-[#2c1d17] text-[#4d352b] dark:text-[#f5ece7] hover:bg-[#ebdfd8] dark:hover:bg-[#362620] active:scale-[0.98] shadow-sm"
          >
            Absensi
          </Link>
        </form>
      </div>
    </div>
  );
}

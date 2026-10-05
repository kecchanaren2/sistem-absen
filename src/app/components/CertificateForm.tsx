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
        setMessage({ text: 'Gagal membuat sertifikat pada perangkat ini.', type: 'error' });
      }
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-[760px] mx-auto flex flex-col bg-[#f8f8fc] dark:bg-[#14182b] rounded-3xl sm:rounded-[28px] md:rounded-[32px] shadow-[0px_12px_32px_-12px_rgba(0,0,0,0.07)] dark:shadow-[0px_12px_32px_-12px_rgba(0,0,0,0.5)] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] transition-all duration-200">
      {/* Header Banner */}
      <div className="relative px-5 sm:px-6 md:px-8 pt-6 sm:pt-7 md:pt-8 pb-7 sm:pb-8 text-white text-center flex flex-col items-center justify-center overflow-hidden bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8]">
        {/* Top Header Actions */}
        <div className="w-full flex items-center justify-between gap-2 mb-4">
          {/* Back to Home Button */}
          <Link
            href="/"
            aria-label="Kembali ke Beranda"
            className="!min-h-0 !min-w-0 p-[5px] sm:p-1.5 rounded-full bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-150 active:scale-90 shadow-sm flex items-center justify-center cursor-pointer"
          >
            <span className="text-xs font-bold px-2 py-0.5">← Home</span>
          </Link>

          {/* Crisp Logo Capsule — 6 Logos on clean white backdrop */}
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

          {/* Theme Toggle Button */}
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

        {/* Main Title */}
        <h2 className="relative z-10 text-3xl sm:text-4xl md:text-[40px] font-extrabold tracking-[-1px] text-white drop-shadow-xs mb-2 leading-none">
          PORTAL SERTIFIKAT
        </h2>
      </div>

      {/* Body Content */}
      <div className="p-5 sm:p-7 md:p-8 flex flex-col space-y-5 bg-[#f8f8fc] dark:bg-[#14182b]">
        <div>
          <h3 className="text-lg font-bold text-[#18192c] dark:text-[#f1f3fd] mb-1">
            Masukkan NIM/NIP Anda
          </h3>
          <p className="text-sm text-[#5d5f7e] dark:text-[#9aa0c2] leading-relaxed">
            Gunakan <strong className="font-semibold text-[#18192c] dark:text-[#f1f3fd]">NIM/NIP</strong> yang Anda input saat mengisi formulir presensi kegiatan.
          </p>
        </div>

        {/* Dynamic Alerts */}
        {message && (
          <div
            className={`p-4 rounded-2xl flex items-start space-x-3 text-sm transition-all duration-200 ${message.type === 'success'
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
          <div className="p-5 bg-blue-500/10 dark:bg-blue-950/40 rounded-2xl border border-blue-500/30 dark:border-blue-800/40 text-center shadow-xs">
            <div className="inline-flex p-2 bg-blue-100 dark:bg-blue-900/60 rounded-full mb-2 text-[#0066ff] dark:text-blue-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#18192c] dark:text-[#f1f3fd] mb-1">
              Selamat! Anda Berhak E-Sertifikat 🎉
            </h3>
            <p className="text-[#5d5f7e] dark:text-[#9aa0c2] text-xs mb-4 leading-relaxed">
              Kehadiran absensi Anda telah terverifikasi dengan valid.
            </p>
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="w-full flex items-center justify-center space-x-2 bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-blue-500/25 touch-manipulation cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Sertifikat</span>
            </button>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          {/* NIP Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.45px] text-[#5d5f7e] dark:text-[#9aa0c2]">
              NIM/NIP
            </label>
            <input
              type="text"
              required
              value={nimNip}
              maxLength={24}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/\D/g, '').slice(0, 24);
                setNimNip(numericValue);
              }}
              className="w-full px-3.5 py-3 text-sm sm:text-base rounded-xl border border-[#c0c2de] dark:border-[#323b63] focus:ring-2 focus:ring-[#0066ff]/30 focus:border-[#0066ff] bg-[#e2e3ef] dark:bg-[#1c223c] text-[#18192c] dark:text-[#eef0fb] placeholder-[#84869e] dark:placeholder-[#6d779f] transition-all shadow-xs touch-manipulation font-mono tracking-wider"
              placeholder="Misal: 123456789"
              autoComplete="off"
            />
          </div>

          {/* Submit / Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center touch-manipulation bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white shadow-md shadow-blue-500/25 cursor-pointer mt-1"
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
          <span className="text-[11px] text-[#6d709a] dark:text-[#8a92b5] font-medium text-center sm:text-left mt-0.5">
            *lakukan absensi terlebih dahulu supaya e-sertifikat dapat diproses
          </span>
          <Link
            href="/"
            className="w-full py-3 px-4 rounded-xl font-bold text-sm sm:text-base transition-all flex justify-center items-center border border-[#a8abd7] dark:border-[#363f68] bg-white/70 dark:bg-[#181d33]/80 text-[#393b5a] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e243d] active:scale-[0.98] shadow-xs cursor-pointer"
          >
            Absensi
          </Link>
        </form>
      </div>
    </div>
  );
}

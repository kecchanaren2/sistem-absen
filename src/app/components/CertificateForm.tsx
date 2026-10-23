'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Download,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  Maximize2,
  X,
  Info,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import type { CertificatePreviewItem } from '@/lib/certificate';

export default function CertificateForm() {
  const [nimNip, setNimNip] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);
  const [namaPeserta, setNamaPeserta] = useState('');
  const [rolePeserta, setRolePeserta] = useState('');

  // Preview & Download States (Single certificate for current event)
  const [preview, setPreview] = useState<CertificatePreviewItem | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Theme state (Dark / Light mode)
  const [isDark, setIsDark] = useState<boolean>(true);

  // Close lightbox modal on Escape key & disable background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewModalOpen) {
        setIsPreviewModalOpen(false);
      }
    };
    if (isPreviewModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPreviewModalOpen]);

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
    setPreview(null);
    setDownloadSuccessMessage(null);

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

      // Jika eligible, langsung generate pratinjau sertifikat tunggal di browser
      if (data.eligible && data.nama_peserta) {
        setIsGeneratingPreview(true);
        try {
          const { generateCertificatePreviews } = await import('@/lib/certificate');
          const certPreviews = await generateCertificatePreviews(
            data.nama_peserta,
            data.role || 'peserta_mahasiswa'
          );
          if (certPreviews && certPreviews.length > 0) {
            setPreview(certPreviews[0]);
          }
        } catch (previewErr) {
          console.error('Gagal membuat pratinjau sertifikat:', previewErr);
        } finally {
          setIsGeneratingPreview(false);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memverifikasi.';
      setMessage({ text: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!preview) return;

    try {
      import('@/lib/certificate').then(({ downloadDataUrl }) => {
        downloadDataUrl(preview.dataUrl, preview.fileName);
        setDownloadSuccessMessage('Sertifikat berhasil diunduh!');
        setTimeout(() => setDownloadSuccessMessage(null), 4500);
      });
    } catch (err) {
      console.error('Download error:', err);
      setMessage({ text: 'Gagal mengunduh berkas sertifikat.', type: 'error' });
    }
  };

  const handleDownloadDirectFallback = async () => {
    if (!namaPeserta) return;
    try {
      const { generateAndDownloadCertificate } = await import('@/lib/certificate');
      await generateAndDownloadCertificate(namaPeserta, rolePeserta);
    } catch (error) {
      console.error('Gagal membuat sertifikat:', error);
      setMessage({ text: 'Gagal membuat sertifikat pada perangkat ini.', type: 'error' });
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
            className={`p-4 rounded-2xl flex items-start space-x-3 text-sm transition-all duration-200 ${
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

        {/* Certificate Card with Visual Preview */}
        {eligibleForCertificate && (
          <div className="p-5 sm:p-6 bg-blue-500/10 dark:bg-blue-950/40 rounded-2xl sm:rounded-3xl border border-blue-500/30 dark:border-blue-800/40 shadow-sm flex flex-col space-y-4">
            {/* Header info */}
            <div className="flex flex-col items-center text-center space-y-1">
              <div className="inline-flex p-2.5 bg-blue-100 dark:bg-blue-900/60 rounded-full text-[#0066ff] dark:text-blue-300 mb-1">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#18192c] dark:text-[#f1f3fd]">
                Selamat, {namaPeserta}! 🎉
              </h3>
              <p className="text-[#5d5f7e] dark:text-[#9aa0c2] text-xs sm:text-sm leading-relaxed max-w-md">
                Kehadiran Anda telah terverifikasi. Berikut adalah pratinjau sertifikat kegiatan Anda:
              </p>
            </div>

            {/* Loading preview state */}
            {isGeneratingPreview && (
              <div className="py-12 px-4 flex flex-col items-center justify-center space-y-3 bg-white/60 dark:bg-[#181d33]/60 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                <Loader2 className="w-8 h-8 text-[#0066ff] animate-spin" />
                <p className="text-sm font-semibold text-[#18192c] dark:text-[#eef0fb]">
                  Menyiapkan pratinjau sertifikat Anda...
                </p>
                <p className="text-xs text-[#5d5f7e] dark:text-[#9aa0c2]">
                  Mencetak nama resmi ke desain template
                </p>
              </div>
            )}

            {/* Preview Available */}
            {!isGeneratingPreview && preview && (
              <div className="flex flex-col space-y-3">
                {/* Certificate Preview Frame with Zoom overlay */}
                <div className="relative group overflow-hidden rounded-2xl border-2 border-blue-400/30 dark:border-blue-500/30 bg-black/5 dark:bg-black/40 shadow-md">
                  <img
                    src={preview.dataUrl}
                    alt={preview.title}
                    className="w-full h-auto object-contain cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.01]"
                    onClick={() => setIsPreviewModalOpen(true)}
                  />

                  {/* Zoom badge button */}
                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    aria-label="Perbesar Pratinjau Sertifikat"
                    className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black/90 text-white text-xs font-bold backdrop-blur-md shadow-lg transition-transform active:scale-95 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Perbesar</span>
                  </button>
                </div>

                <p className="text-[11px] text-center text-[#5d5f7e] dark:text-[#9aa0c2]">
                  Ketuk gambar di atas untuk melihat tampilan penuh (resolusi tinggi)
                </p>

                {/* Success feedback alert */}
                {downloadSuccessMessage && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>{downloadSuccessMessage}</span>
                  </div>
                )}

                {/* Download Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center space-x-2 bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base transition-all shadow-md shadow-blue-500/25 touch-manipulation cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    <span>Unduh Sertifikat (PNG)</span>
                  </button>
                </div>

                {/* Mobile User Tip Box */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/20 dark:border-amber-700/30 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5 leading-relaxed">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tips bagi pengguna smartphone:</span> Jika tombol unduh tidak otomatis menyimpan ke galeri, Anda dapat <strong>menekan dan menahan (tekan lama)</strong> gambar sertifikat di atas, lalu pilih <strong>&quot;Simpan Gambar&quot;</strong> atau <strong>&quot;Download Image&quot;</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Fallback if preview failed to generate */}
            {!isGeneratingPreview && !preview && (
              <div className="flex flex-col space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadDirectFallback}
                  className="w-full flex items-center justify-center space-x-2 bg-[#0066ff] hover:bg-[#0052cc] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-blue-500/25 touch-manipulation cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Sertifikat Langsung</span>
                </button>
              </div>
            )}
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

      {/* Fullscreen Lightbox Modal */}
      {isPreviewModalOpen && preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau Sertifikat Layar Penuh"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-3 sm:p-6 transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          {/* Modal Header */}
          <div
            className="w-full max-w-5xl mx-auto flex items-center justify-between pb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm sm:text-base font-bold drop-shadow">
              {preview.title}
            </span>
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              aria-label="Tutup Pratinjau"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-transform active:scale-90 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content / Large Image */}
          <div
            className="flex-1 w-full max-w-5xl mx-auto flex items-center justify-center overflow-auto p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.dataUrl}
              alt={preview.title}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>

          {/* Modal Footer Controls */}
          <div
            className="w-full max-w-5xl mx-auto pt-3 flex items-center justify-end gap-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Sertifikat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

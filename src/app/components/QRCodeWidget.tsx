'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { QRGenerator } from '@/lib/qr-generator';
import { Download, QrCode, X } from 'lucide-react';

interface QRCodeWidgetProps {
  text?: string;
  logoUrl?: string;
  colorDark?: string;
  displaySize?: number;
  downloadFilename?: string;
  showDownload?: boolean;
  label?: string;
}

export default function QRCodeWidget({
  text,
  logoUrl = '/logo-dies-hitam.svg',
  colorDark = '#114084',
  downloadFilename = 'qr-absensi-dies64.png',
}: QRCodeWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef     = useRef<QRGenerator | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const buildAndRender = useCallback(async () => {
    if (!canvasRef.current) return;
    setReady(false);
    setError(false);

    const resolvedText =
      text ?? (typeof window !== 'undefined' ? window.location.href : '');

    // Convert relative logoUrl to absolute so Image() can load it
    const absoluteLogoUrl =
      logoUrl && typeof window !== 'undefined' && logoUrl.startsWith('/')
        ? `${window.location.origin}${logoUrl}`
        : logoUrl;

    try {
      const qr = new QRGenerator({
        canvas:           canvasRef.current,
        text:             resolvedText,
        logoUrl:          absoluteLogoUrl,
        colorDark,
        colorLight:       '#ffffff',
        qrSize:           512,
        logoBgSize:       150,
        downloadFilename,
      });

      await qr.render();
      qrRef.current = qr;
      

      setQrDataUrl(canvasRef.current.toDataURL('image/png'));
      setReady(true);
    } catch (err) {
      console.error('[QRCodeWidget] Gagal render QR:', err);
      setError(true);
    }
  }, [text, logoUrl, colorDark, downloadFilename]);

  useEffect(() => {
    buildAndRender();
  }, [buildAndRender]);

  const handleDownload = () => {
    qrRef.current?.download();
  };

  return (
    <>
      {/* Hidden Canvas for QR Generation */}
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        style={{ display: 'none' }}
      />

      {/* Button Open Modal */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={!ready || error}
        aria-label="Tampilkan QR Code Absensi"
        title="Tampilkan QR Absensi"
        className="!min-h-0 !min-w-0 p-[5px] rounded-full backdrop-blur-[12px] bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-200 active:scale-90 shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <QrCode className="w-4 h-4 text-white" />
      </button>

      {/* Modal Popup QR */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#fcfaf8] dark:bg-[#241713] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#ebdcd2] dark:border-[#3e2a21] animate-in zoom-in-95 duration-200 flex flex-col relative">
            
            {/* Close Button on Top Right */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-[#7e695d] dark:text-[#a39086] hover:bg-[#efe7e2] dark:hover:bg-[#34241d] rounded-full transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 flex flex-col items-center text-center">
              <h3 className="text-xl font-extrabold text-[#2c1e18] dark:text-[#f5ece7] mb-2">QR Code Absensi</h3>
              <p className="text-sm text-[#7e695d] dark:text-[#b09d92] font-medium mb-6 leading-relaxed">
                Silakan scan QR code di bawah ini menggunakan perangkat lain untuk melakukan absensi.
              </p>

              {/* QR Image Container */}
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#ebdcd2] dark:border-[#3e2a21] mb-6 inline-flex">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] object-contain" />
                ) : (
                  <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] bg-gray-100 flex items-center justify-center rounded-xl">
                    <QrCode className="w-10 h-10 text-gray-400 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#f59e0b] hover:from-[#c2410c] hover:to-[#d97706] active:scale-[0.98] transition-all shadow-md shadow-orange-500/25 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Unduh Gambar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-[#5a4439] dark:text-[#c9b8ae] bg-[#efe7e2] dark:bg-[#34241d] hover:bg-[#e8ded8] dark:hover:bg-[#3d2c23] active:scale-[0.98] transition-all flex items-center justify-center"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

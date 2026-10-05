'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { QRGenerator } from '@/lib/qr-generator';
import { Download, QrCode } from 'lucide-react';

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
  colorDark = '#0467ff',
  downloadFilename = 'qr-absensi-workshop.png',
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
        logoBgSize:       128,
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
        className="!min-h-0 !min-w-0 p-[5px] rounded-full bg-white/35 hover:bg-white/45 border border-white/40 text-white transition-all duration-150 active:scale-90 shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <QrCode className="w-4 h-4 text-white" />
      </button>

      {/* Modal Popup QR — Lightweight Figma style */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-[#f8f8fc] dark:bg-[#14182b] rounded-[16px] shadow-2xl w-full max-w-[340px] sm:max-w-[350px] overflow-hidden border border-[#d2d4eb] dark:border-[#262d49] animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header matching Figma */}
            <div className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] dark:from-[#2563eb] dark:to-[#1d4ed8] px-4 pt-7 pb-6 flex flex-col items-center justify-center text-center text-white shrink-0">
              <h3 className="font-extrabold text-[22px] leading-6 text-white text-center">
                QR Code Absensi
              </h3>
              <p className="font-normal text-[11px] leading-3 text-[#edeeff] text-center mt-1.5">
                Scan kode ini untuk membuka presensi di perangkat lain
              </p>
            </div>

            {/* Body */}
            <div className="p-[18px] flex flex-col space-y-3">
              {/* QR Image Card */}
              <div className="bg-[#f2f3f6] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] rounded-[12px] p-3 flex flex-col items-center justify-center">
                <div className="p-2.5 bg-white rounded-[10px] border border-[#d2d4eb] dark:border-[#323b63] inline-flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code Presensi"
                      className="w-[180px] h-[180px] object-contain"
                      width={180}
                      height={180}
                    />
                  ) : (
                    <div className="w-[180px] h-[180px] bg-gray-100 flex items-center justify-center rounded-lg">
                      <QrCode className="w-10 h-10 text-gray-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <span className="font-mono text-[10px] text-[#5d5f7e] dark:text-[#9aa0c2] mt-2 font-medium">
                  {downloadFilename}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="bg-gradient-to-r from-[#4c95e6] to-[#0467ff] hover:from-[#3b82f6] hover:to-[#0252cc] text-white rounded-[10px] h-[46px] font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Gambar QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-[#e2e3ef] dark:bg-[#1c223c] border border-[#c0c2de] dark:border-[#323b63] text-[#6a6c85] dark:text-[#9aa0c2] hover:text-[#18192c] dark:hover:text-white rounded-[12px] h-[44px] font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer"
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

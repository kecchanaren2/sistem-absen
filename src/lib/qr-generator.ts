/**
 * QRGenerator - Plug & Play QR Code with Logo Overlay
 * Adapted from qr-generator.js -> TypeScript (Next.js / React compatible)
 *
 * Uses: npm package `qrcode` (canvas-based, no CDN required)
 *
 * Usage:
 *   const qr = new QRGenerator({ canvas, text, logoUrl, colorDark, downloadFilename });
 *   await qr.render();
 *   qr.download();
 */

import QRCodeLib from 'qrcode';

export interface QRGeneratorOptions {
  canvas: HTMLCanvasElement;
  text?: string;
  logoUrl?: string;
  colorDark?: string;
  colorLight?: string;
  qrSize?: number;
  logoBgSize?: number;
  downloadFilename?: string;
}

export class QRGenerator {
  private canvas: HTMLCanvasElement;
  private text: string;
  private logoUrl: string;
  private colorDark: string;
  private colorLight: string;
  private qrSize: number;
  private logoBgSize: number;
  private downloadFilename: string;

  constructor(options: QRGeneratorOptions) {
    this.canvas           = options.canvas;
    this.text             = options.text             ?? (typeof window !== 'undefined' ? window.location.href : '');
    this.logoUrl          = options.logoUrl          ?? '';
    this.colorDark        = options.colorDark        ?? '#114084';
    this.colorLight       = options.colorLight       ?? '#ffffff';
    this.qrSize           = options.qrSize           ?? 512;
    this.logoBgSize       = options.logoBgSize       ?? 220;
    this.downloadFilename = options.downloadFilename ?? 'qr-code.png';
  }

  async render(): Promise<void> {
    await QRCodeLib.toCanvas(this.canvas, this.text, {
      width: this.qrSize,
      margin: 1,
      color: {
        dark:  this.colorDark,
        light: this.colorLight,
      },
      errorCorrectionLevel: 'H',
    });

    if (this.logoUrl) {
      await this._overlayLogo();
    }
  }

  private _overlayLogo(): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) { resolve(); return; }

      const img = new Image();
      img.src = this.logoUrl;

      img.onload = () => {
        const cx = this.qrSize / 2;
        const cy = this.qrSize / 2;
        const r  = this.logoBgSize / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.colorLight;
        ctx.fill();

        const offset = (this.qrSize - this.logoBgSize) / 2;
        ctx.drawImage(img, offset, offset, this.logoBgSize, this.logoBgSize);

        resolve();
      };

      img.onerror = () => {
        console.warn(`[QRGenerator] Logo gagal dimuat dari: ${this.logoUrl}`);
        resolve();
      };
    });
  }

  download(filename?: string): boolean {
    const fname = filename ?? this.downloadFilename;

    if (!this.canvas) {
      console.warn('[QRGenerator] Canvas belum siap. Pastikan render() sudah dipanggil.');
      return false;
    }

    const link      = document.createElement('a');
    link.download   = fname;
    link.href       = this.canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
}

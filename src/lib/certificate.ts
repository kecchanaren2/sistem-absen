export interface CertificateDesignConfig {
  id?: string;
  template_url: string;
  font_family: string;
  font_size: number;
  font_color: string;
  x_position: number; // 0.0 - 1.0 (0.5 = tengah)
  y_position: number; // 0.0 - 1.0 (0.3 = 30% dari atas)
  is_custom_enabled?: boolean;
}

export const DEFAULT_CERTIFICATE_CONFIG: CertificateDesignConfig = {
  template_url: '/Peserta_Acara.png',
  font_family: 'Times New Roman',
  font_size: 44,
  font_color: '#000000',
  x_position: 0.5,
  y_position: 0.27,
  is_custom_enabled: false,
};

export function getLocalCertificateConfig(): CertificateDesignConfig {
  if (typeof window === 'undefined') return DEFAULT_CERTIFICATE_CONFIG;
  try {
    const raw = localStorage.getItem('custom_certificate_config');
    if (raw) {
      return { ...DEFAULT_CERTIFICATE_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Error reading local certificate config:', e);
  }
  return DEFAULT_CERTIFICATE_CONFIG;
}

export function saveLocalCertificateConfig(config: CertificateDesignConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('custom_certificate_config', JSON.stringify(config));
  } catch (e) {
    console.warn('Error saving local certificate config:', e);
  }
}

export interface CertificatePreviewItem {
  id: string;
  title: string;
  dataUrl: string;
  fileName: string;
  imageUrl: string;
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function renderCertificateToDataUrl(
  namaPeserta: string,
  imageUrl: string,
  options?: {
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
    xPosRatio?: number;
    yPosRatio?: number;
    fileNameSuffix?: string;
  }
): Promise<{ dataUrl: string; fileName: string }> {
  return new Promise<{ dataUrl: string; fileName: string }>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context not supported');
        }

        // 1. Gambar template sertifikat
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 2. Format kapitalisasi nama
        const capitalizedName = namaPeserta.replace(/\b\w+/g, (word) => {
          const exceptions = ['dr', 'drg', 'drh', 'ns', 'sp', 'apt'];
          if (exceptions.includes(word.toLowerCase())) {
            return word;
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        });

        const fontFamily = options?.fontFamily || '"Times New Roman", Times, serif';
        const fontColor = options?.fontColor || '#000000';
        const isDosenCertificate = imageUrl.includes('Dosen');
        const isPengabdianCertificate = imageUrl.includes('Pengabdian.png');
        const isRelawanPengabdian = imageUrl === '/Relawan_Pengabdian.png';

        let fontSize = options?.fontSize || Math.floor(canvas.width * (isPengabdianCertificate ? 0.035 : 0.05));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = fontColor;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;

        let textWidth = ctx.measureText(capitalizedName).width;
        const maxTextWidth = canvas.width * 0.75;

        while (textWidth > maxTextWidth && fontSize > 10) {
          fontSize -= 2;
          ctx.font = `bold ${fontSize}px ${fontFamily}`;
          textWidth = ctx.measureText(capitalizedName).width;
        }

        const xPosRatio = options?.xPosRatio !== undefined ? options.xPosRatio : 0.5;
        let yPosRatio = options?.yPosRatio !== undefined ? options.yPosRatio : 0.27;
        if (options?.yPosRatio === undefined) {
          if (isDosenCertificate) {
            yPosRatio = 0.37; // <-- PENGATURAN POSISI NAMA KHUSUS DOSEN
          } else if (isRelawanPengabdian) {
            yPosRatio = 0.30;
          } else if (isPengabdianCertificate) {
            yPosRatio = 0.30;
          }
        }

        const xPos = canvas.width * xPosRatio;
        const yPos = canvas.height * yPosRatio;

        ctx.fillText(capitalizedName, xPos, yPos);

        // 3. Konversi ke data URL PNG
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const suffix = options?.fileNameSuffix ? ` - ${options.fileNameSuffix}` : '';
        const fileName = `Sertifikat - ${capitalizedName}${suffix}.png`;

        resolve({ dataUrl, fileName });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Gagal memuat template sertifikat: ${imageUrl}`));
    };

    // Cache-buster: Tambahkan timestamp agar browser HP & CDN selalu mengambil gambar terbaru dari server
    const separator = imageUrl.includes('?') ? '&' : '?';
    img.src = `${imageUrl}${separator}t=${Date.now()}`;
  });
}

export async function renderAndDownloadCanvas(
  namaPeserta: string,
  imageUrl: string,
  options?: {
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
    xPosRatio?: number;
    yPosRatio?: number;
    fileNameSuffix?: string;
  }
) {
  const result = await renderCertificateToDataUrl(namaPeserta, imageUrl, options);
  downloadDataUrl(result.dataUrl, result.fileName);
}

export async function generateCertificatePreviews(
  namaPeserta: string,
  role: string,
  customConfig?: CertificateDesignConfig
): Promise<CertificatePreviewItem[]> {
  const activeConfig = customConfig || getLocalCertificateConfig();
  if (activeConfig && activeConfig.is_custom_enabled && activeConfig.template_url) {
    const res = await renderCertificateToDataUrl(namaPeserta, activeConfig.template_url, {
      fontFamily: activeConfig.font_family,
      fontSize: activeConfig.font_size,
      fontColor: activeConfig.font_color,
      xPosRatio: activeConfig.x_position,
      yPosRatio: activeConfig.y_position,
      fileNameSuffix: 'Custom',
    });
    return [
      {
        id: 'cert-custom',
        title: 'Sertifikat (Kustom)',
        dataUrl: res.dataUrl,
        fileName: res.fileName,
        imageUrl: activeConfig.template_url,
      },
    ];
  }

  // Tentukan template tunggal khusus untuk acara Workshop ini:
  // Dosen / Tendik menggunakan Peserta_Acara_Dosen.png
  // Mahasiswa / Umum menggunakan Peserta_Acara.png
  let templateUrl = '/Peserta_Acara.png';
  let certTitle = 'Sertifikat Workshop';

  const normalizedRole = (role || '').toLowerCase();
  if (
    normalizedRole.includes('dosen') ||
    normalizedRole.includes('tendik')
  ) {
    templateUrl = '/Peserta_Acara_Dosen.png';
    certTitle = 'Sertifikat Workshop';
  } else {
    templateUrl = '/Peserta_Acara.png';
    certTitle = 'Sertifikat Workshop';
  }

  const res = await renderCertificateToDataUrl(namaPeserta, templateUrl);
  return [
    {
      id: 'cert-main',
      title: certTitle,
      dataUrl: res.dataUrl,
      fileName: res.fileName,
      imageUrl: templateUrl,
    },
  ];
}

export async function generateAndDownloadCertificate(
  namaPeserta: string,
  role: string,
  customConfig?: CertificateDesignConfig
) {
  const previews = await generateCertificatePreviews(namaPeserta, role, customConfig);
  if (previews.length > 0) {
    downloadDataUrl(previews[0].dataUrl, previews[0].fileName);
  }
}


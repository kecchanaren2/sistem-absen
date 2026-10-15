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
  return new Promise<void>((resolve, reject) => {
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
          if (exceptions.includes(word)) {
            return word;
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        });

        const fontFamily = options?.fontFamily || '"Times New Roman", Times, serif';
        const fontColor = options?.fontColor || '#000000';
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
          if (isRelawanPengabdian) {
            yPosRatio = 0.30;
          } else if (isPengabdianCertificate) {
            yPosRatio = 0.30;
          }
        }

        const xPos = canvas.width * xPosRatio;
        const yPos = canvas.height * yPosRatio;

        ctx.fillText(capitalizedName, xPos, yPos);

        // 3. Download PNG
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const a = document.createElement('a');
        a.href = dataUrl;

        const suffix = options?.fileNameSuffix ? ` - ${options.fileNameSuffix}` : '';
        const fileName = `Sertifikat - ${capitalizedName}${suffix}.png`;

        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        resolve();
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Gagal memuat template sertifikat: ${imageUrl}`));
    };

    img.src = imageUrl;
  });
}

export async function generateAndDownloadCertificate(namaPeserta: string, role: string, customConfig?: CertificateDesignConfig) {
  // Cek apakah ada custom config atau custom config lokal yang aktif
  const activeConfig = customConfig || getLocalCertificateConfig();
  if (activeConfig && activeConfig.is_custom_enabled && activeConfig.template_url) {
    // Jalankan cetak dengan desain kustom yang diatur admin
    await renderAndDownloadCanvas(namaPeserta, activeConfig.template_url, {
      fontFamily: activeConfig.font_family,
      fontSize: activeConfig.font_size,
      fontColor: activeConfig.font_color,
      xPosRatio: activeConfig.x_position,
      yPosRatio: activeConfig.y_position,
      fileNameSuffix: 'Custom',
    });
    return;
  }

  // Peta template sertifikat berdasarkan role bawaan:
  let templates: string[];

  switch (role) {
    case 'panitia_dosen':
      templates = ['/Panitia_Acara_Dosen.png', '/Peserta_Acara_Dosen.png', '/Peserta_Pengabdian.png'];
      break;
    case 'panitia_mahasiswa':
      templates = ['/Panitia_Acara.png', '/Peserta_Acara.png', '/Peserta_Pengabdian.png'];
      break;
    case 'peserta_dosen':
    case 'peserta_tendik':
      templates = ['/Peserta_Acara_Dosen.png'];
      break;
    case 'pengabdian_dosen':
      templates = ['/Relawan_Pengabdian.png'];
      break;
    case 'pengabdian_mahasiswa':
      templates = ['/Peserta_Pengabdian.png'];
      break;
    case 'peserta_mahasiswa':
    default:
      templates = ['/Peserta_Acara.png'];
      break;
  }

  // Loop untuk mencetak semua sertifikat yang ada di dalam array
  for (let i = 0; i < templates.length; i++) {
    const imageUrl = templates[i];
    await renderAndDownloadCanvas(namaPeserta, imageUrl, {
      fileNameSuffix: templates.length > 1 ? `Lembar ${i + 1}` : undefined,
    });

    if (i < templates.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}


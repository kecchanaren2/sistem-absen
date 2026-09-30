export async function generateAndDownloadCertificate(namaPeserta: string, role: string) {
  // Peta template sertifikat berdasarkan role:
  //
  // panitia_dosen    → 2 sertifikat: sebagai Panitia Dosen + sebagai Peserta Dosen
  // panitia_mahasiswa → 2 sertifikat: sebagai Panitia Mahasiswa + sebagai Peserta Mahasiswa
  // peserta_dosen    → 1 sertifikat: sebagai Peserta Dosen
  // peserta_tendik   → 1 sertifikat: sebagai Peserta Dosen (template sama)
  // peserta_mahasiswa → 1 sertifikat: sebagai Peserta Mahasiswa
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

    await new Promise<void>((resolve, reject) => {
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

          // 2. Tulis teks nama peserta
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000000';

          const capitalizedName = namaPeserta.replace(/\b\w/g, l => l.toUpperCase());
          // Cek apakah ini sertifikat pengabdian secara umum (untuk atur ukuran font max)
          const isPengabdianCertificate = imageUrl.includes('Pengabdian.png');
          const isRelawanPengabdian = imageUrl === '/Relawan_Pengabdian.png';
          let fontSize = Math.floor(canvas.width * (isPengabdianCertificate ? 0.035 : 0.05));
          ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;

          let textWidth = ctx.measureText(capitalizedName).width;
          const maxTextWidth = canvas.width * (isPengabdianCertificate ? 0.6 : 0.7);

          while (textWidth > maxTextWidth && fontSize > 10) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;
            textWidth = ctx.measureText(capitalizedName).width;
          }

          const xPos = canvas.width / 2;

          // KHUSUS Relawan Pengabdian naik ke 0.28, sisanya (termasuk Peserta Pengabdian) tetap di 0.31 atau 0.30
          let yMultiplier = 0.31;
          if (isRelawanPengabdian) {
            yMultiplier = 0.30; // Cuma Relawan Pengabdian yang naik!
          } else if (isPengabdianCertificate) {
            yMultiplier = 0.30; // Peserta Pengabdian normal
          }
          const yPos = canvas.height * yMultiplier;

          ctx.fillText(capitalizedName, xPos, yPos);

          // 3. Download PNG
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          const a = document.createElement('a');
          a.href = dataUrl;

          // Beri nama file yang berbeda jika ada lebih dari 1 sertifikat
          const fileName = templates.length > 1
            ? `Sertifikat - ${capitalizedName} - Lembar ${i + 1}.png`
            : `Sertifikat - ${capitalizedName}.png`;

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

    // Jeda 500ms antar download agar browser tidak memblokir
    if (i < templates.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

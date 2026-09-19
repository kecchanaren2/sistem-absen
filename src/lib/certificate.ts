export async function generateAndDownloadCertificate(namaPeserta: string, role: string) {
  // Tentukan file template berdasarkan role
  const isPanitia = role && role.toLowerCase().includes('panitia');
  const imageUrl = isPanitia ? '/sertifikat-panitia.jpeg' : '/sertifikat-peserta.jpeg';

  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Berguna jika template diload dari domain lain nanti

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Set ukuran canvas sama persis dengan ukuran asli gambar template
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context not supported');
        }

        // 1. Gambar template sertifikat sebagai background utama
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 2. Gambar teks nama peserta
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000'; // Warna hitam, bisa disesuaikan nanti

        // Kapitalisasi nama
        const capitalizedName = namaPeserta.replace(/\b\w/g, l => l.toUpperCase());

        // Kalkulasi ukuran font dinamis (relatif terhadap lebar template)
        // Kita asumsikan ukuran ideal font adalah sekitar 6% dari lebar sertifikat
        let fontSize = Math.floor(canvas.width * 0.05);
        ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;

        let textWidth = ctx.measureText(capitalizedName).width;
        // Batas maksimal lebar teks adalah 70% dari lebar sertifikat
        const maxTextWidth = canvas.width * 0.7;

        // Mengecilkan ukuran font jika namanya terlalu panjang
        while (textWidth > maxTextWidth && fontSize > 10) {
          fontSize -= 2;
          ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;
          textWidth = ctx.measureText(capitalizedName).width;
        }

        // Posisi nama: Di tengah secara horizontal.
        // Untuk vertikal (Y), ini perkiraan umum di tengah agak ke bawah (misal 55% dari atas).
        // Sesuaikan angka 0.55 ini (0.0 sampai 1.0) jika posisi namanya kurang pas di template Anda!
        const xPos = canvas.width / 2;
        const yPos = canvas.height * 0.31;

        ctx.fillText(capitalizedName, xPos, yPos);

        // 3. Ekspor ke PNG dan Trigger Download
        const dataUrl = canvas.toDataURL('image/png', 1.0);

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `Sertifikat - ${capitalizedName}.png`;
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

    // Mulai memuat gambar
    img.src = imageUrl;
  });
}

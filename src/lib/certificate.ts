export async function generateAndDownloadCertificate(namaPeserta: string, role: string) {
  // Tentukan file template berdasarkan role
  const isPanitia = role && role.toLowerCase().includes('panitia');
  
  // Panitia mendapat 2 sertifikat, peserta biasa 1 sertifikat
  const templates = isPanitia 
    ? ['/sertifikat-panitia.jpeg', '/sertifikat-peserta.jpeg'] 
    : ['/sertifikat-peserta.jpeg'];


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
          let fontSize = Math.floor(canvas.width * 0.05);
          ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;

          let textWidth = ctx.measureText(capitalizedName).width;
          const maxTextWidth = canvas.width * 0.7;

          while (textWidth > maxTextWidth && fontSize > 10) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;
            textWidth = ctx.measureText(capitalizedName).width;
          }

          const xPos = canvas.width / 2;
          const yPos = canvas.height * 0.31;
          ctx.fillText(capitalizedName, xPos, yPos);

          // 3. Download PNG
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          const a = document.createElement('a');
          a.href = dataUrl;
          

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

    // Jeda 500ms antar download
    if (i < templates.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

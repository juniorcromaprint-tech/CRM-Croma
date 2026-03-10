/**
 * Utilitário para aplicar marca d'água em imagens usando Canvas.
 * Adiciona Data, Hora e Coordenadas GPS no canto inferior da imagem.
 */
export async function applyWatermark(
  file: File,
  options: {
    lat?: number | null;
    lng?: number | null;
    companyName?: string;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Não foi possível obter o contexto do canvas'));

      // Define o tamanho do canvas igual ao da imagem original
      canvas.width = img.width;
      canvas.height = img.height;

      // Desenha a imagem original
      ctx.drawImage(img, 0, 0);

      // Configurações do texto da marca d'água
      const fontSize = Math.max(20, Math.floor(canvas.width / 40));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Prepara as linhas de texto
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const lines = [
        `${dateStr} - ${timeStr}`,
      ];

      if (options.lat && options.lng) {
        lines.push(`GPS: ${options.lat.toFixed(6)}, ${options.lng.toFixed(6)}`);
      }

      if (options.companyName) {
        lines.unshift(options.companyName.toUpperCase());
      }

      // Desenha o texto no canto inferior direito
      const padding = fontSize;
      let currentY = canvas.height - padding;

      for (let i = lines.length - 1; i >= 0; i--) {
        const textWidth = ctx.measureText(lines[i]).width;
        ctx.fillText(lines[i], canvas.width - textWidth - padding, currentY);
        currentY -= fontSize * 1.2;
      }

      // Converte de volta para Blob
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Erro ao converter canvas para blob'));
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => reject(new Error('Erro ao carregar imagem para marca d\'água'));
    reader.readAsDataURL(file);
  });
}

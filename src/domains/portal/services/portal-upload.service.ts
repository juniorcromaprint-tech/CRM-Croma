import { supabase } from '@/integrations/supabase/client';
import { gerarPreviewArte } from '@/lib/arte-preview';

const ALLOWED_EXTENSIONS = ['pdf', 'ai', 'cdr', 'eps', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'psd'];
// Formatos que gerarPreviewArte consegue processar no browser
const PREVIEWABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

const PREVIEW_BUCKET = 'job-attachments';

export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Tipo não aceito: .${ext}`;
  return null;
}

function isPreviewable(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.includes(ext);
}

/**
 * Gera preview JPG leve, sobe no bucket público e retorna a URL pública.
 * Silencioso em erro — se o preview falhar, o upload do original continua.
 */
async function generateAndUploadPreview(file: File, token: string): Promise<string | null> {
  if (!isPreviewable(file)) return null;
  try {
    const preview = await gerarPreviewArte(file);
    // Path único: proposta-previews/{token-curto}/{timestamp}-{nome}.jpg
    // Usar o token (público por design do portal) como "pasta" do cliente.
    const safeToken = token.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
    const path = `proposta-previews/${safeToken}/${Date.now()}-${baseName}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from(PREVIEW_BUCKET)
      .upload(path, preview.blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadErr) {
      console.warn('[portal-upload] preview upload falhou:', uploadErr.message);
      return null;
    }
    const { data } = supabase.storage.from(PREVIEW_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[portal-upload] gerarPreviewArte falhou:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function uploadFileToPortal(params: {
  token: string;
  file: File;
  clientName: string;
}): Promise<{ id: string; previewUrl: string | null }> {
  const { token, file, clientName } = params;

  // 1) Tenta gerar + subir preview antes de mandar original pro OneDrive
  const previewUrl = await generateAndUploadPreview(file, token);

  // 2) POST original pro Edge (OneDrive)
  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', token);
  formData.append('clientName', clientName);
  if (previewUrl) formData.append('previewUrl', previewUrl);

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-upload-proposta`,
    {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload falhou');
  }

  const data = await res.json();
  if (!data.attachmentId) throw new Error('Upload concluído mas registro não foi salvo');
  return { id: data.attachmentId, previewUrl: data.previewUrl ?? previewUrl };
}

// src/domains/portal/services/portal-upload.service.ts
import { supabase } from '@/integrations/supabase/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['pdf', 'ai', 'cdr', 'eps', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'psd'];

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return 'Arquivo muito grande (máx 50MB)';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Tipo não aceito: .${ext}`;
  return null;
}

export async function uploadFileToPortal(params: {
  token: string;
  file: File;
  clientName: string;
}): Promise<{ id: string }> {
  const { token, file, clientName } = params;

  // 1. Upload to Supabase Storage (temporary)
  const path = `portal-uploads/${token}/${Date.now()}-${file.name}`;
  const { error: storageError } = await supabase.storage
    .from('proposta-uploads')
    .upload(path, file);

  if (storageError) throw new Error(`Upload falhou: ${storageError.message}`);

  // 2. Try OneDrive via Edge Function
  let onedriveFileId: string | null = null;
  let onedriveFileUrl: string | null = null;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', token);

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

    if (res.ok) {
      const data = await res.json();
      onedriveFileId = data.file_id;
      onedriveFileUrl = data.file_url;
    }
  } catch {
    console.warn('OneDrive upload failed, keeping in Storage as fallback');
  }

  // 3. Register attachment via RPC
  const { data, error } = await supabase.rpc('portal_register_attachment', {
    p_token: token,
    p_nome_arquivo: file.name,
    p_tipo_mime: file.type,
    p_tamanho_bytes: file.size,
    p_onedrive_file_id: onedriveFileId,
    p_onedrive_file_url: onedriveFileUrl,
    p_uploaded_by_name: clientName,
  });

  if (error) throw new Error(error.message);
  return { id: data as string };
}

const ALLOWED_EXTENSIONS = ['pdf', 'ai', 'cdr', 'eps', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'psd'];

export function validateFile(file: File): string | null {
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

  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', token);
  formData.append('clientName', clientName);

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
  return { id: data.attachmentId };
}

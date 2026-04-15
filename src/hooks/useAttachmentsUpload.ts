// src/hooks/useAttachmentsUpload.ts
// Hook para upload de multiplos anexos com concorrencia limitada (3), SHA-256 dedup e retry
// v2 (2026-04-14) — fila armazena file+propostaId diretamente (sem busca frágil por state)
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CONCURRENCY = 3;
const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB

const ALLOWED_EXTENSIONS = [
  'pdf', 'ai', 'cdr', 'eps', 'svg',
  'jpg', 'jpeg', 'png', 'tiff', 'tif',
  'psd', 'webp', 'zip', 'rar',
];

const PREVIEW_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export type AttachmentUploadStatus =
  | 'pending'
  | 'computing_hash'
  | 'generating_preview'
  | 'uploading'
  | 'done'
  | 'error'
  | 'duplicate';

export type AttachmentUploadItem = {
  id: string;           // uuid local para key React
  file: File;
  propostaId: string;   // guardado para retry
  status: AttachmentUploadStatus;
  error?: string;
  attachmentId?: string;
  webUrl?: string;
  previewUrl?: string | null;
  duplicateOf?: string;
  sha256?: string;
};

export type UseAttachmentsUpload = {
  items: AttachmentUploadItem[];
  addFiles: (files: File[], propostaId: string) => void;
  retryItem: (itemId: string) => void;
  removeFromQueue: (itemId: string) => void;
  clear: () => void;
  isUploading: boolean;
};

// Fila interna: armazena file + propostaId diretamente para evitar busca frágil por state
type QueueEntry = {
  itemId: string;
  file: File;
  propostaId: string;
};

function generateId(): string {
  return crypto.randomUUID();
}

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function generatePreviewUrl(file: File): Promise<string | null> {
  const ext = getExtension(file.name);
  if (!PREVIEW_EXTENSIONS.includes(ext)) return null;
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string ?? null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  return null;
}

async function uploadFile(
  itemId: string,
  file: File,
  propostaId: string,
  jwtToken: string,
  onUpdate: (id: string, update: Partial<AttachmentUploadItem>) => void
): Promise<void> {
  try {
    // Stage 1: SHA-256
    onUpdate(itemId, { status: 'computing_hash' });
    const sha256 = await computeSha256(file);
    onUpdate(itemId, { sha256 });

    // Stage 2: preview (somente imagens)
    onUpdate(itemId, { status: 'generating_preview' });
    const previewUrl = await generatePreviewUrl(file);

    // Stage 3: upload
    onUpdate(itemId, { status: 'uploading', previewUrl });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('scope', 'proposta');
    formData.append('entityId', propostaId);
    formData.append('fileSha256', sha256);
    if (previewUrl) formData.append('previewUrl', previewUrl);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const res = await fetch(
      `${supabaseUrl}/functions/v1/onedrive-upload-interno`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: formData,
      }
    );

    const json = await res.json();

    if (res.status === 409) {
      onUpdate(itemId, {
        status: 'duplicate',
        duplicateOf: json.duplicate_of,
        error: `Arquivo identico ja existe: "${json.duplicate_name}"`,
      });
      return;
    }

    if (!res.ok) {
      onUpdate(itemId, {
        status: 'error',
        error: json.error ?? `Erro ${res.status}`,
      });
      return;
    }

    onUpdate(itemId, {
      status: 'done',
      attachmentId: json.attachmentId,
      webUrl: json.webUrl,
      previewUrl: previewUrl ?? null,
    });
  } catch (err) {
    onUpdate(itemId, {
      status: 'error',
      error: (err as Error).message ?? 'Falha no upload',
    });
  }
}

export function useAttachmentsUpload(): UseAttachmentsUpload {
  const [items, setItems] = useState<AttachmentUploadItem[]>([]);
  const queueRef = useRef<QueueEntry[]>([]);
  const activeCountRef = useRef(0);
  const jwtTokenRef = useRef<string | null>(null);

  const updateItem = useCallback((id: string, update: Partial<AttachmentUploadItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...update } : it))
    );
  }, []);

  // runNext precisa de referencia estável — usamos useRef para evitar stale closure
  const runNextRef = useRef<() => Promise<void>>(async () => {});

  runNextRef.current = async () => {
    if (activeCountRef.current >= CONCURRENCY) return;
    if (queueRef.current.length === 0) return;

    const next = queueRef.current.shift()!;
    activeCountRef.current++;

    // Obter JWT (cache por sessao)
    if (!jwtTokenRef.current) {
      const { data: { session } } = await supabase.auth.getSession();
      jwtTokenRef.current = session?.access_token ?? null;
    }

    if (!jwtTokenRef.current) {
      updateItem(next.itemId, { status: 'error', error: 'Sessao expirada. Faca login novamente.' });
      activeCountRef.current--;
      runNextRef.current();
      return;
    }

    await uploadFile(next.itemId, next.file, next.propostaId, jwtTokenRef.current, updateItem);
    activeCountRef.current--;

    // Disparar proximo sem recursão infinita
    setTimeout(() => runNextRef.current(), 0);
  };

  const addFiles = useCallback((files: File[], propostaId: string) => {
    const newItems: AttachmentUploadItem[] = [];
    const newQueue: QueueEntry[] = [];

    for (const file of files) {
      const ext = getExtension(file.name);
      const id = generateId();

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        newItems.push({ id, file, propostaId, status: 'error', error: `Extensao .${ext} nao permitida` });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newItems.push({
          id, file, propostaId, status: 'error',
          error: `Arquivo muito grande (max 150MB). Tamanho: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        });
        continue;
      }

      newItems.push({ id, file, propostaId, status: 'pending' });
      newQueue.push({ itemId: id, file, propostaId });
    }

    setItems((prev) => [...prev, ...newItems]);
    queueRef.current.push(...newQueue);

    // Iniciar ate CONCURRENCY workers em paralelo
    const slots = Math.min(CONCURRENCY - activeCountRef.current, newQueue.length);
    for (let i = 0; i < slots; i++) {
      runNextRef.current();
    }
  }, []);

  const retryItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const item = prev.find((it) => it.id === itemId);
      if (!item || !['error', 'duplicate'].includes(item.status)) return prev;

      // Re-enfileirar
      queueRef.current.push({ itemId: item.id, file: item.file, propostaId: item.propostaId });

      // Disparar se houver slot livre
      setTimeout(() => runNextRef.current(), 0);

      return prev.map((it) =>
        it.id === itemId
          ? { ...it, status: 'pending' as const, error: undefined, duplicateOf: undefined, sha256: undefined }
          : it
      );
    });
  }, []);

  const removeFromQueue = useCallback((itemId: string) => {
    queueRef.current = queueRef.current.filter((q) => q.itemId !== itemId);
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }, []);

  const clear = useCallback(() => {
    queueRef.current = [];
    activeCountRef.current = 0;
    setItems([]);
  }, []);

  const isUploading = items.some(
    (it) => ['pending', 'computing_hash', 'generating_preview', 'uploading'].includes(it.status)
  );

  return { items, addFiles, retryItem, removeFromQueue, clear, isUploading };
}

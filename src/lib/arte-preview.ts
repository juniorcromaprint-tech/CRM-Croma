/**
 * arte-preview.ts
 *
 * Gera um preview JPG leve (max 1600px, ~200-400KB) a partir de:
 *  - PDF (renderiza pagina 1 via pdfjs-dist)
 *  - PNG/JPG/JPEG/WEBP (resize via canvas)
 *
 * Usado pelo componente ArteUploader para nao subir o original gigante
 * quando so precisamos de uma visualizacao (ex: App Campo, conferencia).
 */

import * as pdfjs from 'pdfjs-dist'
// Vite resolve o worker como URL estatica
// eslint-disable-next-line import/no-unresolved
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Configura o worker uma unica vez
pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker as unknown as string

const PREVIEW_MAX_SIZE = 1600 // px no lado maior
const PREVIEW_QUALITY = 0.75

export type PreviewResult = {
  /** Blob do preview (image/jpeg) */
  blob: Blob
  /** Largura do preview em px */
  width: number
  /** Altura do preview em px */
  height: number
  /** Fonte usada para gerar o preview */
  source: 'pdf' | 'image'
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
}

/**
 * Redimensiona um canvas (ou imagem) mantendo proporcao,
 * limitando o lado maior a PREVIEW_MAX_SIZE.
 */
function computeTargetSize(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const max = Math.max(sourceWidth, sourceHeight)
  if (max <= PREVIEW_MAX_SIZE) {
    return { width: sourceWidth, height: sourceHeight }
  }
  const scale = PREVIEW_MAX_SIZE / max
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
  }
}

/**
 * Renderiza a pagina 1 de um PDF em canvas e exporta como JPG.
 */
async function generatePdfPreview(file: File): Promise<PreviewResult> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  try {
    const page = await pdf.getPage(1)
    const viewport1x = page.getViewport({ scale: 1 })

    // Escolhe uma escala que deixe o lado maior em PREVIEW_MAX_SIZE
    const baseMax = Math.max(viewport1x.width, viewport1x.height)
    const scale = baseMax === 0 ? 1 : PREVIEW_MAX_SIZE / baseMax
    const viewport = page.getViewport({ scale: Math.min(scale, 2) })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Nao foi possivel criar contexto 2D')

    // Fundo branco pra PDFs com transparencia
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    const blob = await canvasToJpeg(canvas, PREVIEW_QUALITY)
    return { blob, width: canvas.width, height: canvas.height, source: 'pdf' }
  } finally {
    await pdf.destroy()
  }
}

/**
 * Gera preview a partir de uma imagem (PNG/JPG/WEBP).
 */
async function generateImagePreview(file: File): Promise<PreviewResult> {
  const dataUrl = await fileToDataUrl(file)
  const img = await loadImage(dataUrl)
  const { width, height } = computeTargetSize(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Nao foi possivel criar contexto 2D')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToJpeg(canvas, PREVIEW_QUALITY)
  return { blob, width, height, source: 'image' }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar canvas como JPEG'))),
      'image/jpeg',
      quality,
    )
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error ?? new Error('Falha ao ler arquivo'))
    fr.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Falha ao carregar imagem'))
    img.src = src
  })
}

/**
 * Gera um preview a partir de qualquer arquivo suportado.
 * Lanca erro se o formato nao for suportado.
 */
export async function gerarPreviewArte(file: File): Promise<PreviewResult> {
  if (isPdf(file)) return generatePdfPreview(file)
  if (isImage(file)) return generateImagePreview(file)
  throw new Error(
    `Formato nao suportado para gerar preview: ${file.type || file.name}. Use PDF, PNG, JPG ou WEBP.`,
  )
}

/** Lista de extensoes aceitas pelo uploader. */
export const FORMATOS_SUPORTADOS_ARTE = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'] as const

// src/domains/portal/components/PortalWhatsAppButton.tsx
import { MessageCircle } from 'lucide-react'

interface Props {
  telefone: string | null | undefined
  nomeVendedor?: string | null | undefined
  propostaNumero: string
  variant?: 'floating' | 'inline'
}

/**
 * Botão WhatsApp do vendedor. Renderiza nada se o telefone for inválido.
 * - variant="floating": botão flutuante bottom-right (z-40)
 * - variant="inline": link inline para colocar dentro do bloco do vendedor
 */
export function PortalWhatsAppButton({
  telefone,
  nomeVendedor,
  propostaNumero,
  variant = 'floating',
}: Props) {
  if (!telefone) return null
  const cleanPhone = telefone.replace(/\D/g, '')
  if (cleanPhone.length < 10) return null

  // Garante prefixo 55 (Brasil) sem duplicar
  const wa = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

  const saudacao = nomeVendedor ? `Olá ${nomeVendedor}` : 'Olá'
  const msg = encodeURIComponent(
    `${saudacao}! Tenho uma dúvida sobre a proposta ${propostaNumero}.`,
  )
  const url = `https://wa.me/${wa}?text=${msg}`

  if (variant === 'floating') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-white shadow-lg shadow-green-600/30 hover:bg-green-700 hover:shadow-green-600/50 transition-all duration-200"
        aria-label="Falar com vendedor no WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-semibold hidden sm:inline">Falar com vendedor</span>
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
      <span>{nomeVendedor ? `Falar com ${nomeVendedor}` : 'Falar com vendedor'}</span>
    </a>
  )
}

export default PortalWhatsAppButton

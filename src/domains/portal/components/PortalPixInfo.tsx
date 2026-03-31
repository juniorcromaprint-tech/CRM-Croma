import { useState } from 'react'
import { Copy, CheckCircle2, Zap, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PortalPixInfoProps {
  chavePix: string
  valor: number
  beneficiario?: string
}

/**
 * Gera payload PIX estático (BR Code) conforme padrão EMV QRCPS.
 * Formato simplificado: chave + valor + beneficiário.
 */
function gerarPayloadPix(chavePix: string, valor: number, beneficiario: string): string {
  const pad = (id: string, val: string) => id + String(val.length).padStart(2, '0') + val

  // Merchant Account Info (chave PIX)
  const mai = pad('00', 'BR.GOV.BCB.PIX') + pad('01', chavePix)

  let payload = ''
  payload += pad('00', '01')                    // Payload Format Indicator
  payload += pad('26', mai)                      // Merchant Account Info
  payload += pad('52', '0000')                   // MCC (0000 = não informado)
  payload += pad('53', '986')                    // Moeda (BRL)
  if (valor > 0) {
    payload += pad('54', valor.toFixed(2))       // Valor
  }
  payload += pad('58', 'BR')                     // País
  payload += pad('59', beneficiario.substring(0, 25)) // Nome beneficiário (max 25)
  payload += pad('60', 'SAO LEOPOLDO')           // Cidade (max 15)
  payload += pad('62', pad('05', '***'))         // Additional Data (txid)

  // CRC16-CCITT
  payload += '6304'
  const crc = crc16CCITT(payload)
  payload += crc.toString(16).toUpperCase().padStart(4, '0')

  return payload
}

function crc16CCITT(str: string): number {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
    }
    crc &= 0xFFFF
  }
  return crc
}

export default function PortalPixInfo({ chavePix, valor, beneficiario = 'CROMA PRINT' }: PortalPixInfoProps) {
  const [copiado, setCopiado] = useState(false)
  const [copiadoPayload, setCopiadoPayload] = useState(false)

  const payload = gerarPayloadPix(chavePix, valor, beneficiario)

  const copiarChave = async () => {
    try {
      await navigator.clipboard.writeText(chavePix)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      fallbackCopy(chavePix)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    }
  }

  const copiarPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopiadoPayload(true)
      setTimeout(() => setCopiadoPayload(false), 3000)
    } catch {
      fallbackCopy(payload)
      setCopiadoPayload(true)
      setTimeout(() => setCopiadoPayload(false), 3000)
    }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Pague via PIX</p>
          <p className="text-xs text-emerald-600">Aprovação instantânea</p>
        </div>
      </div>

      {/* Chave PIX */}
      <div className="bg-white border border-emerald-200 rounded-xl p-3 mb-3">
        <p className="text-xs text-slate-500 mb-1">Chave PIX</p>
        <p className="text-sm font-mono font-medium text-slate-800 break-all">{chavePix}</p>
      </div>

      {/* Botões */}
      <div className="space-y-2">
        <Button
          onClick={copiarChave}
          className={`w-full rounded-xl text-sm font-medium transition-all ${
            copiado
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
          size="sm"
        >
          {copiado ? (
            <><CheckCircle2 size={14} className="mr-1.5" /> Chave copiada!</>
          ) : (
            <><Copy size={14} className="mr-1.5" /> Copiar chave PIX</>
          )}
        </Button>

        {valor > 0 && (
          <Button
            onClick={copiarPayload}
            variant="outline"
            className={`w-full rounded-xl text-sm font-medium border-emerald-300 transition-all ${
              copiadoPayload ? 'text-emerald-700 bg-emerald-50' : 'text-emerald-600 hover:bg-emerald-50'
            }`}
            size="sm"
          >
            {copiadoPayload ? (
              <><CheckCircle2 size={14} className="mr-1.5" /> Código copiado!</>
            ) : (
              <><QrCode size={14} className="mr-1.5" /> Copiar PIX Copia e Cola</>
            )}
          </Button>
        )}
      </div>

      <p className="text-xs text-emerald-700 mt-2 text-center">
        Após o pagamento, envie o comprovante pelo WhatsApp ou e-mail
      </p>
    </div>
  )
}

function fallbackCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

import { useState } from 'react'
import { Copy, CheckCircle2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PortalPixInfoProps {
  chavePix: string
  valor: number
}

export default function PortalPixInfo({ chavePix, valor: _valor }: PortalPixInfoProps) {
  const [copiado, setCopiado] = useState(false)

  const copiarChave = async () => {
    try {
      await navigator.clipboard.writeText(chavePix)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      const el = document.createElement('textarea')
      el.value = chavePix
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
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

      <div className="bg-white border border-emerald-200 rounded-xl p-3 mb-3">
        <p className="text-xs text-slate-500 mb-1">Chave PIX</p>
        <p className="text-sm font-mono font-medium text-slate-800 break-all">{chavePix}</p>
      </div>

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

      <p className="text-xs text-emerald-700 mt-2 text-center">
        Após o pagamento, envie o comprovante pelo WhatsApp ou e-mail
      </p>
    </div>
  )
}

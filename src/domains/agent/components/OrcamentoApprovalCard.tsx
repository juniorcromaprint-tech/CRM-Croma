import { FileText, Pencil, Check, X, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { brl } from '@/shared/utils/format';

interface OrcamentoMetadata {
  tipo: 'orcamento';
  proposta_id: string;
  proposta_numero: string;
  share_token: string;
  portal_url: string;
  total: number;
  itens_count: number;
}

interface OrcamentoApprovalCardProps {
  msg: {
    id: string;
    canal: string;
    conteudo: string;
    custo_ia: number;
    modelo_ia: string | null;
    metadata: OrcamentoMetadata;
  };
  lead: {
    empresa: string;
    contato_nome: string | null;
  } | null;
  onApproveAndSend: () => void;
  onReject: () => void;
  isApproveAndSendPending: boolean;
  isRejectPending: boolean;
}

export function OrcamentoApprovalCard({
  msg,
  lead,
  onApproveAndSend,
  onReject,
  isApproveAndSendPending,
  isRejectPending,
}: OrcamentoApprovalCardProps) {
  const { metadata } = msg;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-600 text-white">ORÇAMENTO IA</Badge>
          <Badge variant="outline">
            {msg.canal === 'whatsapp' ? 'WhatsApp' : 'Email'}
          </Badge>
          <span className="text-sm text-slate-500 ml-auto">
            {lead?.empresa || lead?.contato_nome || 'Lead desconhecido'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-slate-700">
            {metadata.proposta_numero} — {metadata.itens_count}{' '}
            {metadata.itens_count === 1 ? 'item' : 'itens'}
          </p>
          <p className="text-xl font-bold text-blue-700 mt-1">
            Total: {brl(metadata.total)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400 mb-1">Mensagem para o lead:</p>
          <p className="text-sm text-slate-600 whitespace-pre-line">{msg.conteudo}</p>
        </div>

        <div className="flex gap-2 text-xs text-slate-400">
          {msg.modelo_ia && <span>IA: {msg.modelo_ia}</span>}
          {msg.custo_ia > 0 && (
            <span>• Custo: ${msg.custo_ia.toFixed(4)}</span>
          )}
          <a
            href={metadata.portal_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-blue-500 hover:text-blue-700"
          >
            <ExternalLink size={11} />
            Ver portal
          </a>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/orcamentos/${metadata.proposta_id}`, '_blank')}
        >
          <FileText className="h-4 w-4 mr-1" />
          Ver Proposta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/orcamentos/${metadata.proposta_id}/editar`, '_blank')}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Editar
        </Button>

        <div className="ml-auto flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onReject}
            disabled={isRejectPending || isApproveAndSendPending}
          >
            <X className="h-4 w-4 mr-1" />
            Rejeitar
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={onApproveAndSend}
            disabled={isApproveAndSendPending || isRejectPending}
          >
            <Check className="h-4 w-4 mr-1" />
            Aprovar e Enviar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

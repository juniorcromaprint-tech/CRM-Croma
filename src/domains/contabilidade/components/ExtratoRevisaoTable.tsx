import { EyeOff, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { brl, formatDate } from '@/shared/utils/format';
import type { ExtratoItem } from '../types/contabilidade.types';

interface ContaOption {
  id: string;
  codigo: string;
  nome: string;
}

interface ExtratoRevisaoTableProps {
  itens: ExtratoItem[];
  contas: ContaOption[];
  onClassificar: (itemId: string, contaPlanoId: string) => void;
  onIgnorar: (itemId: string) => void;
  onClassificarIA: () => void;
  onGerarLancamentos: () => void;
  isClassificandoIA?: boolean;
  isGerando?: boolean;
}

function confiancaColor(confianca: number | null, classificadoPor: string | null): string {
  if (!confianca || !classificadoPor) return 'bg-slate-50';
  if (confianca >= 0.85) return 'bg-green-50';
  if (confianca >= 0.5) return 'bg-amber-50';
  return 'bg-red-50';
}

function confiancaBadge(confianca: number | null, classificadoPor: string | null): string {
  if (!confianca || !classificadoPor) return '';
  if (confianca >= 0.85) return '🟢';
  if (confianca >= 0.5) return '🟡';
  return '🔴';
}

export function ExtratoRevisaoTable({
  itens,
  contas,
  onClassificar,
  onIgnorar,
  onClassificarIA,
  onGerarLancamentos,
  isClassificandoIA,
  isGerando,
}: ExtratoRevisaoTableProps) {
  const pendentes = itens.filter(i => !i.ignorado && !i.lancamento_id);
  const classificados = itens.filter(i => !i.ignorado && i.conta_plano_id && !i.lancamento_id);
  const lancados = itens.filter(i => i.lancamento_id);
  const ignorados = itens.filter(i => i.ignorado);

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{pendentes.length} pendentes</span>
          <span className="text-green-600 font-medium">{classificados.length} classificados</span>
          <span className="text-slate-400">{lancados.length} lançados</span>
          <span className="text-slate-400">{ignorados.length} ignorados</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onClassificarIA}
            disabled={isClassificandoIA || pendentes.length === 0}
          >
            <Sparkles size={14} className={isClassificandoIA ? 'animate-pulse text-blue-500' : ''} />
            {isClassificandoIA ? 'Classificando...' : 'Classificar com IA'}
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-2"
            onClick={onGerarLancamentos}
            disabled={isGerando || classificados.length === 0}
          >
            {isGerando ? 'Gerando...' : `Gerar ${classificados.length} Lançamentos`}
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Descrição</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium w-64">Conta Contábil</th>
                <th className="px-4 py-3 text-center font-medium">Conf.</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((item) => (
                <tr
                  key={item.id}
                  className={`${item.ignorado ? 'opacity-40' : ''} ${confiancaColor(item.confianca_ia, item.classificado_por)} hover:bg-slate-50`}
                >
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(item.data)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs">
                    <p className="truncate text-xs">{item.descricao_original}</p>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold text-xs ${
                    item.valor >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {item.valor >= 0 ? '+' : ''}{brl(item.valor)}
                  </td>
                  <td className="px-4 py-3">
                    {item.lancamento_id ? (
                      <span className="text-xs text-slate-400">
                        {item.conta_plano?.codigo} — {item.conta_plano?.nome}
                      </span>
                    ) : item.ignorado ? (
                      <span className="text-xs text-slate-300">Ignorado</span>
                    ) : (
                      <Select
                        value={item.conta_plano_id || ''}
                        onValueChange={(v) => onClassificar(item.id, v)}
                      >
                        <SelectTrigger className="h-7 text-xs rounded-xl">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contas.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.codigo} — {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-base">
                    {confiancaBadge(item.confianca_ia, item.classificado_por)}
                    {item.classificado_por === 'regra' && '📋'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.lancamento_id ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Lançado</span>
                    ) : item.ignorado ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Ignorado</span>
                    ) : item.conta_plano_id ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Classificado</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!item.lancamento_id && (
                      <button
                        className="text-slate-300 hover:text-red-400 transition-colors"
                        onClick={() => onIgnorar(item.id)}
                        title="Ignorar"
                      >
                        <EyeOff size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

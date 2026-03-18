import { useState, useMemo } from 'react';
import { FileText, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDASHistorico } from '../hooks/useDAS';
import { brl } from '@/shared/utils/format';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function DEFISPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [copied, setCopied] = useState(false);

  const { data: dasHistorico = [], isLoading } = useDASHistorico(ano);

  const relatorio = useMemo(() => {
    const mesesData = MESES.map((mes, idx) => {
      const comp = `${ano}-${String(idx + 1).padStart(2, '0')}-01`;
      const das = dasHistorico.find(d => d.competencia.startsWith(comp.substring(0, 7)));
      return {
        mes,
        receita: das?.receita_bruta_mes ?? 0,
        das: das?.valor_das ?? 0,
        status: das?.status ?? null,
        aliquota: das?.aliquota_efetiva ?? 0,
      };
    });

    const totalReceita = mesesData.reduce((s, m) => s + m.receita, 0);
    const totalDAS = mesesData.reduce((s, m) => s + m.das, 0);
    const rbt12 = dasHistorico[0]?.rbt12 ?? 0;
    const aliquotaMedia = totalReceita > 0
      ? mesesData.filter(m => m.aliquota > 0).reduce((s, m) => s + m.aliquota, 0) /
        (mesesData.filter(m => m.aliquota > 0).length || 1)
      : 0;

    return { mesesData, totalReceita, totalDAS, rbt12, aliquotaMedia };
  }, [dasHistorico, ano]);

  function handleCopy() {
    const texto = [
      `DEFIS — DECLARAÇÃO DE INFORMAÇÕES SOCIOECONÔMICAS E FISCAIS`,
      `Ano-Calendário: ${ano}`,
      ``,
      `MÊS          | RECEITA BRUTA   | DAS          | STATUS`,
      ...relatorio.mesesData.map(m =>
        `${m.mes.padEnd(12)} | ${brl(m.receita).padStart(15)} | ${brl(m.das).padStart(12)} | ${m.status ?? 'N/A'}`
      ),
      ``,
      `TOTAL        | ${brl(relatorio.totalReceita).padStart(15)} | ${brl(relatorio.totalDAS).padStart(12)}`,
      `RBT12: ${brl(relatorio.rbt12)}`,
      `Alíquota Média Efetiva: ${(relatorio.aliquotaMedia * 100).toFixed(2)}%`,
    ].join('\n');

    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">DEFIS</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Declaração de Informações Socioeconômicas e Fiscais — Simples Nacional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500">Ano:</Label>
          <Input
            type="number"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 h-8 rounded-xl text-sm"
            min={2020}
            max={2099}
          />
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Receita Total {ano}</p>
          <p className="text-lg font-bold text-slate-800">{brl(relatorio.totalReceita)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total DAS Pago</p>
          <p className="text-lg font-bold text-red-600">{brl(relatorio.totalDAS)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">RBT12</p>
          <p className="text-lg font-bold text-slate-800">{brl(relatorio.rbt12)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Alíquota Média</p>
          <p className="text-lg font-bold text-blue-600">
            {(relatorio.aliquotaMedia * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Tabela mensal */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Apuração Mensal — {ano}</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleCopy}
          >
            {copied ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
            {copied ? 'Copiado!' : 'Copiar Relatório'}
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="px-5 py-3 text-left font-medium">Mês</th>
                  <th className="px-5 py-3 text-right font-medium">Receita Bruta</th>
                  <th className="px-5 py-3 text-right font-medium">Alíquota Ef.</th>
                  <th className="px-5 py-3 text-right font-medium">DAS</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatorio.mesesData.map((m) => (
                  <tr key={m.mes} className={m.receita === 0 ? 'opacity-40' : 'hover:bg-slate-50'}>
                    <td className="px-5 py-3 font-medium text-slate-700">{m.mes}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {m.receita > 0 ? brl(m.receita) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 text-xs">
                      {m.aliquota > 0 ? `${(m.aliquota * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">
                      {m.das > 0 ? brl(m.das) : '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {m.status ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.status === 'pago' ? 'bg-green-100 text-green-700' :
                          m.status === 'conferido' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {m.status === 'pago' ? 'Pago' : m.status === 'conferido' ? 'Conferido' : 'Calculado'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-700 border-t border-slate-200">
                  <td className="px-5 py-3">TOTAL</td>
                  <td className="px-5 py-3 text-right">{brl(relatorio.totalReceita)}</td>
                  <td className="px-5 py-3 text-right text-sm">
                    {(relatorio.aliquotaMedia * 100).toFixed(2)}%
                  </td>
                  <td className="px-5 py-3 text-right text-red-600">{brl(relatorio.totalDAS)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Aviso */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Sobre a DEFIS</p>
        <p className="text-xs text-blue-600">
          A DEFIS é entregue até 31/03 do ano seguinte ao ano-calendário, pelo Portal do Simples Nacional
          (simples.receita.fazenda.gov.br). Os dados aqui são informativos — sempre confirme com seu contador.
        </p>
      </div>
    </div>
  );
}

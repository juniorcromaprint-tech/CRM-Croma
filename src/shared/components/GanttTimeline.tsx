// src/shared/components/GanttTimeline.tsx
// Carga de setores/recursos — eixo Y: recursos, eixo X: horas do dia
// Implementação pura com divs posicionados (sem libs pesadas)
import type { GanttBar } from '@/domains/producao/types/pcp.types';

interface Recurso {
  id: string;
  nome: string;
  cor: string;
}

interface GanttTimelineProps {
  bars: GanttBar[];
  recursos: Recurso[];
  inicioHora?: number;  // default 7
  fimHora?: number;     // default 18
}

const HORA_W = 80;   // px por hora
const ROW_H = 56;    // px por linha de recurso
const LABEL_W = 148; // px da coluna de labels

export default function GanttTimeline({
  bars,
  recursos,
  inicioHora = 7,
  fimHora = 18,
}: GanttTimelineProps) {
  const totalHoras = fimHora - inicioHora;
  const totalW = totalHoras * HORA_W;
  const horas = Array.from({ length: totalHoras + 1 }, (_, i) => inicioHora + i);

  // Posição X (px) de um timestamp
  const xDe = (ts: Date): number => {
    const h = ts.getHours() + ts.getMinutes() / 60;
    return Math.max(0, Math.min(totalW, (h - inicioHora) * HORA_W));
  };

  // Linha "agora"
  const agora = new Date();
  const xAgora = xDe(agora);
  const hAgora = agora.getHours();
  const mostraAgora = hAgora >= inicioHora && hAgora < fimHora;

  const totalH = Math.max(recursos.length * ROW_H, ROW_H);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white select-none">
      <div style={{ minWidth: LABEL_W + totalW + 32 }}>
        {/* ─── Header de horas ──────────────────────────── */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {/* Espaço do label */}
          <div style={{ width: LABEL_W, minWidth: LABEL_W }}
            className="px-3 py-2 text-xs font-medium text-slate-500 flex-shrink-0">
            Setor
          </div>
          {/* Horas */}
          <div className="relative flex-1" style={{ height: 32 }}>
            {horas.map((h) => (
              <div
                key={h}
                className="absolute top-0 flex items-center justify-center"
                style={{ left: (h - inicioHora) * HORA_W - 16, width: 32, height: 32 }}
              >
                <span className="text-xs text-slate-400">{h}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Área do Gantt ────────────────────────────── */}
        <div className="relative" style={{ height: totalH }}>
          {/* Grid vertical (linhas de hora) */}
          {horas.map((h) => (
            <div
              key={h}
              className="absolute top-0 bottom-0 border-l border-slate-100"
              style={{ left: LABEL_W + (h - inicioHora) * HORA_W }}
            />
          ))}

          {/* Linha "agora" */}
          {mostraAgora && (
            <div
              className="absolute top-0 bottom-0 z-10"
              style={{ left: LABEL_W + xAgora }}
            >
              <div className="w-px h-full bg-red-400" />
              <div className="absolute top-1 -left-1 w-2 h-2 rounded-full bg-red-400" />
            </div>
          )}

          {/* ─── Linhas por recurso ───────────────────── */}
          {recursos.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Nenhum setor configurado
            </div>
          ) : (
            recursos.map((recurso, rowIdx) => {
              const y = rowIdx * ROW_H;
              const barsDoRecurso = bars.filter(
                (b) => b.setor_nome === recurso.nome
              );

              return (
                <div
                  key={recurso.id}
                  className="absolute flex items-center border-b border-slate-100"
                  style={{ top: y, left: 0, right: 0, height: ROW_H }}
                >
                  {/* Label */}
                  <div
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                    className="flex-shrink-0 px-3 flex items-center gap-2 h-full"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: recurso.cor }}
                    />
                    <span className="text-xs font-medium text-slate-600 truncate">
                      {recurso.nome}
                    </span>
                  </div>

                  {/* Barras */}
                  <div className="relative flex-1 h-full">
                    {barsDoRecurso.length === 0 && (
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs text-slate-300">Sem apontamentos hoje</span>
                      </div>
                    )}
                    {barsDoRecurso.map((bar) => {
                      const x1 = xDe(bar.inicio);
                      const x2 = bar.fim ? xDe(bar.fim) : xAgora;
                      const w = Math.max(4, x2 - x1);
                      const isAtivo = !bar.fim;

                      return (
                        <div
                          key={bar.id}
                          title={`${bar.op_numero} — ${bar.etapa_nome} (${bar.operador_nome})`}
                          className="absolute rounded flex items-center px-2 overflow-hidden"
                          style={{
                            left: x1,
                            width: w,
                            top: 8,
                            bottom: 8,
                            backgroundColor: bar.cor,
                            opacity: isAtivo ? 0.75 : 1,
                            border: isAtivo ? '2px dashed rgba(255,255,255,0.6)' : 'none',
                          }}
                        >
                          {w > 56 && (
                            <span className="text-xs text-white font-medium truncate">
                              {bar.op_numero}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

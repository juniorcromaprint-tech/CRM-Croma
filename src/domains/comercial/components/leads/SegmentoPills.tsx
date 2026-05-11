// src/domains/comercial/components/leads/SegmentoPills.tsx
// Pills clicáveis de segmento + sub-segmento com contagem.
// Substitui os <Select> simples — permite multi-seleção e dá overview rápido.
// Fonte: redesign UX 2026-05-04L (mockup aprovado).

import { useLeadsDisparoCountsBySegmento, useLeadsDisparoCountsBySub } from '../../hooks/useLeadsDisparo';
import type { LeadsFilterState } from '../../hooks/useLeadsDisparo';

const SEGMENTO_LABELS: Record<string, string> = {
  seguranca:    'Segurança',
  calcados:     'Calçados',
  varejo:       'Varejo',
  franquia:     'Franquias',
  supermercado: 'Supermercados',
  farmacia:     'Farmácias',
  academia:     'Academias',
  restaurante:  'Restaurantes',
  concessionaria: 'Concessionárias',
  shopping:     'Shoppings',
  outro:        'Outros',
};

const SUB_SEGMENTO_LABELS: Record<string, string> = {
  vigilancia_patrimonial: 'Vigilância',
  seguranca_eletronica:   'Eletrônica',
  portaria_acesso:        'Portaria',
  monitoramento_24h:      'Monitoramento',
};

const SUB_SEGMENTO_TONES: Record<string, string> = {
  vigilancia_patrimonial: 'data-[on=true]:bg-purple-50 data-[on=true]:text-purple-700 data-[on=true]:border-purple-300',
  seguranca_eletronica:   'data-[on=true]:bg-orange-50 data-[on=true]:text-orange-700 data-[on=true]:border-orange-300',
  portaria_acesso:        'data-[on=true]:bg-pink-50 data-[on=true]:text-pink-700 data-[on=true]:border-pink-300',
  monitoramento_24h:      'data-[on=true]:bg-amber-50 data-[on=true]:text-amber-700 data-[on=true]:border-amber-300',
};

interface Props {
  filters: LeadsFilterState;
  onChange: (next: Partial<LeadsFilterState>) => void;
}

export function SegmentoPills({ filters, onChange }: Props) {
  const { data: segCounts }  = useLeadsDisparoCountsBySegmento(filters);
  const { data: subCounts }  = useLeadsDisparoCountsBySub(filters);

  const segs = Object.entries(segCounts?.counts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const subs = filters.segmentos?.length
    ? Object.entries(subCounts?.counts ?? {}).sort((a, b) => b[1] - a[1])
    : [];

  const toggleSegmento = (s: string) => {
    const cur = filters.segmentos ?? [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    // Trocar segmento limpa sub-segmentos (evita filtros inconsistentes)
    onChange({ segmentos: next.length ? next : undefined, subSegmentos: undefined });
  };

  const toggleSub = (s: string) => {
    const cur = filters.subSegmentos ?? [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    onChange({ subSegmentos: next.length ? next : undefined });
  };

  const segAtivos = filters.segmentos ?? [];
  const subAtivos = filters.subSegmentos ?? [];

  return (
    <div className="space-y-2">
      {/* Linha de segmentos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mr-1">
          Segmento
        </span>
        <Pill
          label="Todos"
          count={segCounts?.total ?? 0}
          on={segAtivos.length === 0}
          onClick={() => onChange({ segmentos: undefined, subSegmentos: undefined })}
        />
        {segs.map(([s, n]) => (
          <Pill
            key={s}
            label={SEGMENTO_LABELS[s] ?? capitalize(s)}
            count={n}
            on={segAtivos.includes(s)}
            onClick={() => toggleSegmento(s)}
          />
        ))}
      </div>

      {/* Linha de sub-segmentos (só aparece se houver segmento ativo) */}
      {subs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mr-1">
            Sub-segmento
          </span>
          {subs.map(([s, n]) => (
            <Pill
              key={s}
              label={SUB_SEGMENTO_LABELS[s] ?? capitalize(s)}
              count={n}
              on={subAtivos.includes(s)}
              onClick={() => toggleSub(s)}
              extraClass={SUB_SEGMENTO_TONES[s]}
            />
          ))}
          {(subCounts?.semSub ?? 0) > 0 && (
            <span className="text-[11px] text-slate-300 ml-1">
              ({subCounts!.semSub} sem sub-seg.)
            </span>
          )}
        </div>
      )}

      {/* v5 UX (2026-05-11): Pills de Score visíveis (Quente/Morno/Frio).
          Antes só ficavam escondidas em "Mais filtros". */}
      <ScorePills filters={filters} onChange={onChange} />
    </div>
  );
}

// ─── Score pills ─────────────────────────────────────────────────────────────

interface ScoreRange {
  id: 'todos' | 'quente' | 'morno' | 'frio';
  label: string;
  min: number | undefined;
  max: number | undefined;
  tone: string;
}

const SCORE_RANGES: ScoreRange[] = [
  { id: 'todos',  label: 'Todos',         min: undefined, max: undefined, tone: '' },
  { id: 'quente', label: 'Quente (70+)',  min: 70,        max: undefined, tone: 'data-[on=true]:bg-red-50 data-[on=true]:text-red-700 data-[on=true]:border-red-300' },
  { id: 'morno',  label: 'Morno (30-69)', min: 30,        max: 69,        tone: 'data-[on=true]:bg-amber-50 data-[on=true]:text-amber-700 data-[on=true]:border-amber-300' },
  { id: 'frio',   label: 'Frio (<30)',    min: undefined, max: 29,        tone: 'data-[on=true]:bg-sky-50 data-[on=true]:text-sky-700 data-[on=true]:border-sky-300' },
];

function ScorePills({ filters, onChange }: Props) {
  const activeRange: ScoreRange['id'] = (() => {
    const { scoreMin, scoreMax } = filters;
    if (scoreMin === undefined && scoreMax === undefined) return 'todos';
    if (scoreMin === 70 && scoreMax === undefined) return 'quente';
    if (scoreMin === 30 && scoreMax === 69) return 'morno';
    if (scoreMin === undefined && scoreMax === 29) return 'frio';
    return 'todos'; // range custom feito via "Mais filtros" — não destaca pill
  })();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mr-1">
        Score
      </span>
      {SCORE_RANGES.map(r => (
        <button
          key={r.id}
          type="button"
          data-on={activeRange === r.id}
          onClick={() => onChange({ scoreMin: r.min, scoreMax: r.max })}
          className={[
            'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
            'data-[on=false]:bg-white data-[on=false]:text-slate-600 data-[on=false]:border-slate-200 data-[on=false]:hover:bg-slate-50',
            !r.tone && 'data-[on=true]:bg-blue-50 data-[on=true]:text-blue-700 data-[on=true]:border-blue-300',
            r.tone,
          ].filter(Boolean).join(' ')}
        >
          <span className="font-medium">{r.label}</span>
        </button>
      ))}
    </div>
  );
}

interface PillProps {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
  extraClass?: string;
}

function Pill({ label, count, on, onClick, extraClass }: PillProps) {
  return (
    <button
      type="button"
      data-on={on}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors',
        'data-[on=false]:bg-white data-[on=false]:text-slate-600 data-[on=false]:border-slate-200 data-[on=false]:hover:bg-slate-50',
        // Default ativo (sobrescrito por extraClass se presente)
        !extraClass && 'data-[on=true]:bg-blue-50 data-[on=true]:text-blue-700 data-[on=true]:border-blue-300',
        extraClass ?? '',
      ].filter(Boolean).join(' ')}
    >
      <span className="font-medium">{label}</span>
      <span className={on ? 'opacity-80' : 'text-slate-400'}>{count}</span>
    </button>
  );
}

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

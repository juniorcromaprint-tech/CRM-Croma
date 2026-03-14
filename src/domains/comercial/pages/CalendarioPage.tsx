import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarIcon,
  Package,
  FileText,
  Info,
  Phone,
  MapPin,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useCalendarioEvents,
  type CalendarioEvent,
  type CalendarioEventKind,
} from "@/domains/comercial/hooks/useCalendario";

// ── helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function today30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function toDate(ev: CalendarioEvent): Date {
  const [y, m, d] = ev.data.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── event config ────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<
  CalendarioEventKind,
  {
    label: string;
    dotColor: string;
    bg: string;
    border: string;
    text: string;
    Icon: React.ElementType;
  }
> = {
  entrega: {
    label: "Entrega",
    dotColor: "bg-orange-400",
    bg: "bg-orange-50",
    border: "border-orange-100",
    text: "text-orange-600",
    Icon: Package,
  },
  vencimento: {
    label: "Vencimento",
    dotColor: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-600",
    Icon: FileText,
  },
  follow_up: {
    label: "Follow-up",
    dotColor: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-600",
    Icon: Phone,
  },
  visita: {
    label: "Visita",
    dotColor: "bg-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-100",
    text: "text-purple-600",
    Icon: MapPin,
  },
};

const ENTITY_PATH: Record<string, string> = {
  pedido: "/pedidos",
  orcamento: "/orcamentos",
  lead: "/leads",
};

const ALL_KINDS: CalendarioEventKind[] = ["entrega", "vencimento", "follow_up", "visita"];

// ── component ───────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [activeFilters, setActiveFilters] = useState<Set<CalendarioEventKind>>(
    new Set(ALL_KINDS)
  );

  const { data: rawEvents = [] } = useCalendarioEvents();

  const events = useMemo(
    () => rawEvents.filter((e) => activeFilters.has(e.tipo)),
    [rawEvents, activeFilters]
  );

  const eventsByDate = useMemo<Record<string, CalendarioEvent[]>>(() => {
    const map: Record<string, CalendarioEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.data]) map[ev.data] = [];
      map[ev.data].push(ev);
    }
    return map;
  }, [events]);

  const datesWithEntrega = useMemo<Date[]>(
    () => events.filter((e) => e.tipo === "entrega").map(toDate),
    [events]
  );
  const datesWithVencimento = useMemo<Date[]>(
    () => events.filter((e) => e.tipo === "vencimento").map(toDate),
    [events]
  );
  const datesWithFollowUp = useMemo<Date[]>(
    () => events.filter((e) => e.tipo === "follow_up").map(toDate),
    [events]
  );

  const selectedDateKey = useMemo<string | null>(() => {
    if (!selectedDate) return null;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const selectedEvents = useMemo<CalendarioEvent[]>(
    () => (selectedDateKey ? eventsByDate[selectedDateKey] ?? [] : []),
    [selectedDateKey, eventsByDate]
  );

  const upcomingEvents = useMemo<CalendarioEvent[]>(() => {
    const from = todayKey();
    const to = today30Days();
    return events
      .filter((e) => e.data >= from && e.data <= to)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [events]);

  function toggleFilter(kind: CalendarioEventKind) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function handleEventClick(ev: CalendarioEvent) {
    const base = ENTITY_PATH[ev.entidade_tipo];
    if (base) navigate(`${base}/${ev.entidade_id}`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Calendário</h1>
          <p className="text-sm text-slate-500">
            Hub integrado — entregas, vencimentos, follow-ups e visitas
          </p>
        </div>
      </div>

      {/* Filter toggles */}
      <div className="flex flex-wrap gap-2">
        {ALL_KINDS.map((kind) => {
          const cfg = KIND_CONFIG[kind];
          const active = activeFilters.has(kind);
          return (
            <Button
              key={kind}
              size="sm"
              variant={active ? "default" : "outline"}
              className={`rounded-xl h-8 text-xs gap-1.5 ${
                active
                  ? "bg-slate-800 hover:bg-slate-700 text-white"
                  : "text-slate-500"
              }`}
              onClick={() => toggleFilter(kind)}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              {cfg.label}
            </Button>
          );
        })}
      </div>

      {/* Main grid: calendar + day panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Calendar card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 w-fit">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{
              hasEntrega: datesWithEntrega,
              hasVencimento: datesWithVencimento,
              hasFollowUp: datesWithFollowUp,
            }}
            modifiersClassNames={{
              hasEntrega:
                "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-orange-400",
              hasVencimento:
                "relative before:absolute before:bottom-1 before:left-[calc(50%-5px)] before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-500",
              hasFollowUp: "ring-1 ring-inset ring-emerald-300",
            }}
            locale={undefined}
          />

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Legenda
            </p>
            {ALL_KINDS.map((kind) => {
              const cfg = KIND_CONFIG[kind];
              return (
                <div key={kind} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className={`w-3 h-3 rounded-full ${cfg.dotColor} shrink-0`} />
                  {cfg.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day events panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[420px]">
          {selectedDateKey ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-800">
                  {formatDateBR(selectedDateKey)}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {selectedEvents.length}{" "}
                  {selectedEvents.length === 1 ? "evento" : "eventos"}
                </Badge>
              </div>

              {selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                  <Info className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Nenhum evento neste dia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onClick={() => handleEventClick(ev)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-16">
              <CalendarIcon className="w-12 h-12 opacity-30" />
              <p className="text-sm text-center max-w-[200px]">
                Selecione uma data para ver os eventos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming 30 days */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            Próximos 30 dias
          </h2>
          <Badge variant="secondary" className="text-xs">
            {upcomingEvents.length}{" "}
            {upcomingEvents.length === 1 ? "evento" : "eventos"}
          </Badge>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
            <Info className="w-4 h-4" />
            <p className="text-sm">Nenhum evento nos próximos 30 dias</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
            {upcomingEvents.map((ev) => (
              <UpcomingRow
                key={ev.id}
                event={ev}
                onClick={() => handleEventClick(ev)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function EventCard({
  event,
  onClick,
}: {
  event: CalendarioEvent;
  onClick: () => void;
}) {
  const cfg = KIND_CONFIG[event.tipo];
  const Icon = cfg.Icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border hover:opacity-80 transition-opacity ${cfg.bg} ${cfg.border}`}
    >
      <div
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}
      >
        <Icon className={`w-4 h-4 ${cfg.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{event.titulo}</p>
        {event.subtitulo && (
          <p className="text-xs text-slate-500 mt-0.5">{event.subtitulo}</p>
        )}
      </div>
      <Badge variant="outline" className={`shrink-0 text-xs ${cfg.text}`}>
        {cfg.label}
      </Badge>
    </button>
  );
}

function UpcomingRow({
  event,
  onClick,
}: {
  event: CalendarioEvent;
  onClick: () => void;
}) {
  const cfg = KIND_CONFIG[event.tipo];

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />
      <span className="text-xs font-mono text-slate-400 w-20 shrink-0">
        {formatDateBR(event.data)}
      </span>
      <span className="text-sm text-slate-700 truncate flex-1">{event.titulo}</span>
      <Badge variant="outline" className={`text-xs shrink-0 ${cfg.text}`}>
        {cfg.label}
      </Badge>
    </button>
  );
}

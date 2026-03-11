import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, Package, FileText, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

// ── helpers ────────────────────────────────────────────────────────────────

function toDateKey(dateStr: string): string {
  // normalise any ISO string to "YYYY-MM-DD"
  return dateStr.slice(0, 10);
}

function today30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ── types ──────────────────────────────────────────────────────────────────

interface Pedido {
  id: string;
  numero: number | null;
  data_prometida: string | null;
  status: string | null;
  clientes: { nome_fantasia: string | null } | null;
}

interface Orcamento {
  id: string;
  numero: number | null;
  validade_ate: string | null;
  status: string | null;
}

type EventKind = "entrega" | "vencimento";

interface CalendarEvent {
  id: string;
  kind: EventKind;
  dateKey: string;
  label: string;
  sublabel: string;
  status: string | null;
}

// ── component ──────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // ── data fetching ────────────────────────────────────────────────────────

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ["calendario_pedidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, numero, data_prometida, status, clientes(nome_fantasia)")
        .not("data_prometida", "is", null)
        .is("excluido_em", null);
      return (data ?? []) as Pedido[];
    },
  });

  const { data: orcamentos = [] } = useQuery<Orcamento[]>({
    queryKey: ["calendario_orcamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orcamentos")
        .select("id, numero, validade_ate, status")
        .not("validade_ate", "is", null)
        .is("excluido_em", null);
      return (data ?? []) as Orcamento[];
    },
  });

  // ── build events list ────────────────────────────────────────────────────

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];

    for (const p of pedidos) {
      if (!p.data_prometida) continue;
      const dateKey = toDateKey(p.data_prometida);
      const cliente = p.clientes?.nome_fantasia ?? "Cliente";
      list.push({
        id: `pedido-${p.id}`,
        kind: "entrega",
        dateKey,
        label: `Pedido #${p.numero ?? p.id.slice(0, 6)} — ${cliente}`,
        sublabel: p.status ?? "",
        status: p.status,
      });
    }

    for (const o of orcamentos) {
      if (!o.validade_ate) continue;
      const dateKey = toDateKey(o.validade_ate);
      list.push({
        id: `orc-${o.id}`,
        kind: "vencimento",
        dateKey,
        label: `Orçamento #${o.numero ?? o.id.slice(0, 6)} — vencimento`,
        sublabel: o.status ?? "",
        status: o.status,
      });
    }

    return list;
  }, [pedidos, orcamentos]);

  // ── maps for quick lookup ────────────────────────────────────────────────

  const eventsByDate = useMemo<Record<string, CalendarEvent[]>>(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.dateKey]) map[ev.dateKey] = [];
      map[ev.dateKey].push(ev);
    }
    return map;
  }, [events]);

  // Dates that have at least one event (for DayPicker modifiers)
  const datesWithEntrega = useMemo<Date[]>(() => {
    return events
      .filter((e) => e.kind === "entrega")
      .map((e) => {
        const [y, m, d] = e.dateKey.split("-").map(Number);
        return new Date(y, m - 1, d);
      });
  }, [events]);

  const datesWithVencimento = useMemo<Date[]>(() => {
    return events
      .filter((e) => e.kind === "vencimento")
      .map((e) => {
        const [y, m, d] = e.dateKey.split("-").map(Number);
        return new Date(y, m - 1, d);
      });
  }, [events]);

  // ── selected day events ──────────────────────────────────────────────────

  const selectedDateKey = useMemo<string | null>(() => {
    if (!selectedDate) return null;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const selectedEvents = useMemo<CalendarEvent[]>(() => {
    if (!selectedDateKey) return [];
    return eventsByDate[selectedDateKey] ?? [];
  }, [selectedDateKey, eventsByDate]);

  // ── upcoming 30 days ─────────────────────────────────────────────────────

  const upcomingEvents = useMemo<CalendarEvent[]>(() => {
    const from = todayKey();
    const to = today30Days();
    return events
      .filter((e) => e.dateKey >= from && e.dateKey <= to)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [events]);

  // ── render ───────────────────────────────────────────────────────────────

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
            Hub integrado — entregas, vencimentos e compromissos
          </p>
        </div>
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
            }}
            modifiersClassNames={{
              hasEntrega: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-orange-400",
              hasVencimento: "relative before:absolute before:bottom-1 before:left-[calc(50%-5px)] before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-500",
            }}
            locale={undefined}
          />

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Legenda
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              Vencimentos financeiros
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-3 h-3 rounded-full bg-orange-400 shrink-0" />
              Entregas de pedidos
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              Reuniões / compromissos
            </div>
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
                    <EventCard key={ev.id} event={ev} />
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
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
            {upcomingEvents.map((ev) => (
              <UpcomingRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
  const isEntrega = event.kind === "entrega";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border ${
        isEntrega
          ? "border-orange-100 bg-orange-50"
          : "border-blue-100 bg-blue-50"
      }`}
    >
      <div
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isEntrega ? "bg-orange-100" : "bg-blue-100"
        }`}
      >
        {isEntrega ? (
          <Package className="w-4 h-4 text-orange-600" />
        ) : (
          <FileText className="w-4 h-4 text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {event.label}
        </p>
        {event.sublabel && (
          <p className="text-xs text-slate-500 mt-0.5">{event.sublabel}</p>
        )}
      </div>
      <Badge
        className={`shrink-0 text-xs ${
          isEntrega
            ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"
            : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"
        }`}
        variant="outline"
      >
        {isEntrega ? "Entrega" : "Vencimento"}
      </Badge>
    </div>
  );
}

function UpcomingRow({ event }: { event: CalendarEvent }) {
  const isEntrega = event.kind === "entrega";

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isEntrega ? "bg-orange-400" : "bg-blue-500"
        }`}
      />
      <span className="text-xs font-mono text-slate-400 w-20 shrink-0">
        {formatDateBR(event.dateKey)}
      </span>
      <span className="text-sm text-slate-700 truncate flex-1">
        {event.label}
      </span>
      <Badge
        variant="outline"
        className={`text-xs shrink-0 ${
          isEntrega
            ? "border-orange-200 text-orange-600"
            : "border-blue-200 text-blue-600"
        }`}
      >
        {isEntrega ? "Entrega" : "Vencimento"}
      </Badge>
    </div>
  );
}

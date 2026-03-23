import type { OrdemProducaoRow, EtapaRow } from "../types/producao.types";
import { ETAPA_LABELS } from "../types/producao.types";

export function generateNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `OP-${year}-${seq}`;
}

export function getClienteName(op: OrdemProducaoRow): string {
  const c = op.pedido_itens?.pedidos?.clientes;
  if (!c) return "---";
  return c.nome_fantasia || c.razao_social;
}

export function getPedidoNumero(op: OrdemProducaoRow): string {
  return op.pedido_itens?.pedidos?.numero ?? "---";
}

export function getItemDescricao(op: OrdemProducaoRow): string {
  return op.pedido_itens?.descricao ?? "Sem descricao";
}

export function isOverdue(op: OrdemProducaoRow): boolean {
  if (!op.prazo_interno) return false;
  if (op.status === "finalizado") return false;
  return new Date(op.prazo_interno) < new Date();
}

export function getEtapaAtual(etapas: EtapaRow[]): string {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const emAndamento = sorted.find((e) => e.status === "em_andamento");
  if (emAndamento) return ETAPA_LABELS[emAndamento.nome] ?? emAndamento.nome;
  const pendente = sorted.find((e) => e.status === "pendente");
  if (pendente) return ETAPA_LABELS[pendente.nome] ?? pendente.nome;
  return "Concluído";
}

export function getProgressPercent(etapas: EtapaRow[]): number {
  if (etapas.length === 0) return 0;
  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  return Math.round((concluidas / etapas.length) * 100);
}

export function formatMinutes(min: number | null): string {
  if (min == null || min === 0) return "---";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

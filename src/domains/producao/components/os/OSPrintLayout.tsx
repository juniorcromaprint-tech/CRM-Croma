// OSPrintLayout — A4 print/PDF layout for Ordem de Serviço
// IMPORTANT: All styles MUST be inline (React CSSProperties).
// html2pdf.js renders off-screen without access to Tailwind classes.

import React, { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '@/shared/utils/format';
import type { OSData, OSOPData, OSItem, OSEtapa } from '../../types/ordem-servico';
import { ETAPA_STATUS_ICON } from '../../types/ordem-servico';
import { CROMA_LOGO_BASE64 } from '@/shared/constants/logo';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OSPrintLayoutProps {
  data: OSData | OSOPData;
  mode: 'pedido' | 'op';
  qrUrl: string;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isPedidoOS(data: OSData | OSOPData): data is OSData {
  return 'itens' in data;
}

// ---------------------------------------------------------------------------
// Status badge colors (inline — no Tailwind)
// ---------------------------------------------------------------------------

function getStatusStyle(status: string): { badge: CSSProperties } {
  switch (status) {
    case 'concluido':
    case 'finalizado':
      return { badge: { backgroundColor: '#dcfce7', color: '#166534' } };
    case 'em_producao':
      return { badge: { backgroundColor: '#fff7ed', color: '#9a3412' } };
    case 'cancelado':
      return { badge: { backgroundColor: '#fef2f2', color: '#991b1b' } };
    case 'aguardando_aprovacao':
      return { badge: { backgroundColor: '#fffbeb', color: '#92400e' } };
    case 'aprovado':
      return { badge: { backgroundColor: '#eff6ff', color: '#1e40af' } };
    case 'em_acabamento':
      return { badge: { backgroundColor: '#f5f3ff', color: '#5b21b6' } };
    case 'produzido':
      return { badge: { backgroundColor: '#ecfdf5', color: '#065f46' } };
    case 'aguardando_instalacao':
    case 'em_instalacao':
      return { badge: { backgroundColor: '#ecfeff', color: '#155e75' } };
    default:
      return { badge: { backgroundColor: '#eff6ff', color: '#1e40af' } };
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    aguardando_aprovacao: 'Aguardando Aprovação',
    aprovado: 'Aprovado',
    em_producao: 'Em Produção',
    em_acabamento: 'Em Acabamento',
    produzido: 'Produzido',
    aguardando_instalacao: 'Aguardando Instalação',
    em_instalacao: 'Em Instalação',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    // OP statuses
    aguardando_programacao: 'Aguardando Programação',
    em_fila: 'Em Fila',
    em_conferencia: 'Em Conferência',
    liberado: 'Liberado',
    retrabalho: 'Retrabalho',
    finalizado: 'Finalizado',
  };
  return labels[status] ?? status;
}

// ---------------------------------------------------------------------------
// Sub-components (all inline styles)
// ---------------------------------------------------------------------------

const styles = {
  page: {
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    fontSize: '11px',
    color: '#1e293b',
    maxWidth: '210mm',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    padding: '12mm 14mm',
    lineHeight: '1.4',
  } as CSSProperties,

  separator: {
    borderTop: '1px solid #e2e8f0',
    margin: '10px 0',
  } as CSSProperties,

  sectionTitle: {
    fontSize: '10px',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    color: '#64748b',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  } as CSSProperties,

  label: {
    fontSize: '10px',
    color: '#64748b',
    marginBottom: '1px',
  } as CSSProperties,

  value: {
    fontSize: '11px',
    color: '#1e293b',
    fontWeight: '500' as const,
  } as CSSProperties,
};

// ---------------------------------------------------------------------------
// Etapas Timeline
// ---------------------------------------------------------------------------

// Production process icons (Mubisys style)
const PROCESS_ICONS: Record<string, string> = {
  arquivo: '📁',
  arquivos: '📁',
  arte: '🎨',
  impressao: '🖨️',
  impressão: '🖨️',
  corte: '✂️',
  acabamento: '🔧',
  acabamentos: '🔧',
  laminacao: '🔧',
  laminação: '🔧',
  montagem: '🔩',
  conferencia: '✅',
  conferência: '✅',
  expedicao: '📦',
  expedição: '📦',
  instalacao: '🏗️',
  instalação: '🏗️',
  entrega: '🚚',
};

function getProcessIcon(nome: string): string {
  const key = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return PROCESS_ICONS[key] ?? ETAPA_STATUS_ICON['pendente'] ?? '⏳';
}

function EtapasTimeline({ etapas }: { etapas: OSEtapa[] }) {
  if (!etapas || etapas.length === 0) return null;

  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const totalMinutos = sorted.reduce((s, e) => s + (e.tempo_estimado_min ?? 0), 0);

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div style={styles.sectionTitle}>Processo de Produção</div>
        {totalMinutos > 0 && (
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600' }}>
            Tempo total estimado: {totalMinutos >= 60 ? `${Math.floor(totalMinutos / 60)}h${totalMinutos % 60 > 0 ? ` ${totalMinutos % 60}min` : ''}` : `${totalMinutos}min`}
          </div>
        )}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '0',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {sorted.map((etapa, idx) => {
          const isConcluida = etapa.status === 'concluida';
          const isAndamento = etapa.status === 'em_andamento';
          const bgColor = isConcluida ? '#dcfce7' : isAndamento ? '#dbeafe' : '#f8fafc';
          const borderColor = isConcluida ? '#16a34a' : isAndamento ? '#2563eb' : '#e2e8f0';
          const icon = getProcessIcon(etapa.nome);

          return (
            <div
              key={etapa.id}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                backgroundColor: bgColor,
                borderRight: idx < sorted.length - 1 ? `1px solid ${borderColor}` : 'none',
                borderBottom: isAndamento ? `3px solid #2563eb` : isConcluida ? '3px solid #16a34a' : '3px solid transparent',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '3px' }}>{icon}</div>
              <div style={{
                fontSize: '8px',
                fontWeight: '700',
                color: isConcluida ? '#166534' : isAndamento ? '#1e40af' : '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                lineHeight: '1.2',
              }}>
                {etapa.nome}
              </div>
              {etapa.tempo_estimado_min != null && etapa.tempo_estimado_min > 0 && (
                <div style={{
                  fontSize: '8px',
                  color: '#94a3b8',
                  marginTop: '2px',
                }}>
                  {etapa.tempo_estimado_min}min
                </div>
              )}
              {isConcluida && (
                <div style={{
                  fontSize: '8px',
                  color: '#16a34a',
                  fontWeight: '700',
                  marginTop: '1px',
                }}>✓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Item Block
// ---------------------------------------------------------------------------

function ItemBlock({ item, index }: { item: OSItem; index: number }) {
  const larguraM = item.largura_cm != null ? (item.largura_cm / 100).toFixed(2) : null;
  const alturaM = item.altura_cm != null ? (item.altura_cm / 100).toFixed(2) : null;
  const areaStr = item.area_m2 != null ? item.area_m2.toFixed(4) : null;

  return (
    <div style={{ pageBreakInside: 'avoid', marginBottom: '12px' }}>
      {/* Item header — blue bar (Mubisys style) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1d4ed8',
        padding: '7px 10px',
        borderRadius: '4px 4px 0 0',
        color: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '1px 7px',
            fontSize: '11px',
            fontWeight: '800',
          }}>
            {index + 1}
          </span>
          <span style={{ fontWeight: '700', fontSize: '12px' }}>
            {item.descricao}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
          {item.op_numero && (
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '1px 7px',
              fontWeight: '600',
            }}>
              OP: {item.op_numero}
            </span>
          )}
          <span style={{ fontWeight: '700' }}>
            Qtd: {item.quantidade} {item.unidade}
          </span>
        </div>
      </div>

      {/* Structured info grid (Mubisys style: Produto | Modelo | Acabamentos | Dimensões) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
        fontSize: '10px',
      }}>
        {/* Produto */}
        <div style={{ padding: '5px 8px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            Produto
          </div>
          <div style={{ color: '#1e293b', fontWeight: '500' }}>{item.descricao}</div>
        </div>
        {/* Modelo */}
        <div style={{ padding: '5px 8px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            Modelo
          </div>
          <div style={{ color: '#1e293b', fontWeight: '500' }}>{item.modelo_nome ?? '—'}</div>
        </div>
        {/* Acabamentos */}
        <div style={{ padding: '5px 8px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            Acabamentos
          </div>
          <div style={{ color: '#1e293b', fontWeight: '500' }}>
            {item.acabamentos && item.acabamentos.length > 0
              ? item.acabamentos.join(', ')
              : '—'}
          </div>
        </div>
        {/* Dimensões */}
        <div style={{ padding: '5px 8px' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            Dimensões
          </div>
          <div style={{ color: '#1e293b', fontWeight: '500' }}>
            {larguraM && alturaM
              ? `${larguraM}m × ${alturaM}m${areaStr ? ` (${areaStr} m²)` : ''}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Especificação */}
      {item.especificacao && (
        <div style={{
          fontSize: '10px',
          color: '#475569',
          padding: '5px 8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
        }}>
          <strong style={{ color: '#64748b' }}>Especificação: </strong>{item.especificacao}
        </div>
      )}

      {/* Instruções */}
      {item.instrucoes && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderTop: 'none',
          padding: '5px 8px',
          fontSize: '10px',
          color: '#92400e',
        }}>
          <strong>⚠️ Instruções: </strong>{item.instrucoes}
        </div>
      )}

      {/* Materials table (Matéria-Prima — Mubisys style) */}
      {item.materiais && item.materiais.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '10px',
          marginTop: '0',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: '700', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Matéria-Prima
              </th>
              <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: '700', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '60px', fontSize: '9px', textTransform: 'uppercase' }}>
                Unidade
              </th>
              <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: '700', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '90px', fontSize: '9px', textTransform: 'uppercase' }}>
                Consumo
              </th>
            </tr>
          </thead>
          <tbody>
            {item.materiais.map((mat) => (
              <tr key={mat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '4px 8px', color: '#1e293b', fontWeight: '500' }}>{mat.nome}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>{mat.unidade}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#1e293b' }}>
                  {mat.quantidade_prevista.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OSPrintLayout({ data, mode, qrUrl }: OSPrintLayoutProps) {
  const isPedido = isPedidoOS(data);

  // Derived values
  const numero = isPedido ? data.numero : data.op_numero;
  const status = isPedido ? data.status : data.op_status;
  const dataEntrega = isPedido ? data.data_prometida : data.data_prometida;
  const aprovadoEm = isPedido ? data.aprovado_em : null;
  const aprovadoPor = isPedido ? data.aprovado_por : null;
  const vendedor = data.vendedor_nome;
  const cliente = data.cliente;
  const etapas = data.etapas;
  const observacoes = data.observacoes;
  const itens: OSItem[] = isPedido ? data.itens : [data.item];

  const { badge: badgeStyle } = getStatusStyle(status);
  const statusLabel = getStatusLabel(status);

  // Address builder
  const parts: string[] = [];
  if (cliente.endereco) parts.push(cliente.endereco);
  if (cliente.numero) parts.push(cliente.numero);
  if (cliente.complemento) parts.push(cliente.complemento);
  if (cliente.bairro) parts.push(cliente.bairro);
  if (cliente.cidade) parts.push(cliente.cidade);
  if (cliente.estado) parts.push(cliente.estado);
  if (cliente.cep) parts.push(cliente.cep);
  const enderecoCompleto = parts.join(', ');

  const cnpjDisplay = cliente.cnpj ?? cliente.cpf_cnpj;

  return (
    <div style={styles.page}>
      {/* ------------------------------------------------------------------ */}
      {/* HEADER — Logo + OS info + QR (estilo Mubisys)                       */}
      {/* ------------------------------------------------------------------ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        paddingBottom: '10px',
        borderBottom: '3px solid #1d4ed8',
      }}>
        {/* Left: Logo */}
        <div style={{ minWidth: '140px' }}>
          <img
            src={CROMA_LOGO_BASE64}
            alt="Croma Print"
            style={{ height: '48px', objectFit: 'contain' }}
          />
        </div>

        {/* Center: OS info */}
        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.08em', marginBottom: '2px' }}>
            {mode === 'op' ? 'Ordem de Produção' : 'Ordem de Serviço'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>
            Nº {numero}
          </div>
          <div style={{ marginTop: '4px' }}>
            <span style={{
              ...badgeStyle,
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 10px',
              borderRadius: '9999px',
              display: 'inline-block',
            }}>
              {statusLabel}
            </span>
          </div>
          {dataEntrega && (
            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600', marginTop: '3px' }}>
              📅 Entrega: {formatDate(dataEntrega)}
            </div>
          )}
        </div>

        {/* Right: Approval + QR */}
        <div style={{ textAlign: 'right', minWidth: '70px' }}>
          {aprovadoEm && (
            <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>
              Aprovação: {formatDate(aprovadoEm)}
              {aprovadoPor && <span><br />{aprovadoPor}</span>}
            </div>
          )}
          <QRCodeSVG value={qrUrl} size={56} level="M" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CLIENTE                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: '8px' }}>
        <div style={styles.sectionTitle}>Cliente</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Left */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              {cliente.nome_fantasia ?? cliente.razao_social}
            </div>
            {cliente.nome_fantasia && (
              <div style={{ fontSize: '10px', color: '#475569' }}>{cliente.razao_social}</div>
            )}
            {cnpjDisplay && (
              <div style={{ fontSize: '10px', color: '#475569' }}>CNPJ/CPF: {cnpjDisplay}</div>
            )}
          </div>
          {/* Right */}
          <div>
            {cliente.telefone && (
              <div style={{ fontSize: '10px', color: '#475569' }}>Tel: {cliente.telefone}</div>
            )}
            {cliente.email && (
              <div style={{ fontSize: '10px', color: '#475569' }}>E-mail: {cliente.email}</div>
            )}
            {vendedor && (
              <div style={{ fontSize: '10px', color: '#475569' }}>Vendedor: {vendedor}</div>
            )}
          </div>
        </div>
        {enderecoCompleto && (
          <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
            Endereço: {enderecoCompleto}
          </div>
        )}
      </div>

      <div style={styles.separator} />

      {/* ------------------------------------------------------------------ */}
      {/* ETAPAS TIMELINE                                                     */}
      {/* ------------------------------------------------------------------ */}
      {etapas && etapas.length > 0 && (
        <>
          <EtapasTimeline etapas={etapas} />
          <div style={styles.separator} />
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ITEMS                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: '8px' }}>
        <div style={styles.sectionTitle}>
          {mode === 'op' ? 'Item da Produção' : `Itens (${itens.length})`}
        </div>
        {itens.map((item, idx) => (
          <React.Fragment key={item.id}>
            <ItemBlock item={item} index={idx} />
            {idx < itens.length - 1 && (
              <div style={{ borderTop: '1px dashed #e2e8f0', margin: '8px 0' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={styles.separator} />

      {/* ------------------------------------------------------------------ */}
      {/* LOGÍSTICA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '10px' }}>
        <div style={{ color: '#475569' }}>
          <strong style={{ color: '#1e293b' }}>Logística:</strong> Entrega / Instalação
        </div>
        {dataEntrega && (
          <div style={{ color: '#dc2626', fontWeight: '600' }}>
            Previsão: {formatDate(dataEntrega)}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* OBSERVAÇÕES                                                         */}
      {/* ------------------------------------------------------------------ */}
      {observacoes && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '4px',
          padding: '6px 10px',
          marginBottom: '10px',
          fontSize: '10px',
          color: '#92400e',
        }}>
          <strong>Observações: </strong>{observacoes}
        </div>
      )}

      <div style={styles.separator} />

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER — Professional with logo reference                           */}
      {/* ------------------------------------------------------------------ */}
      <div style={{
        borderTop: '2px solid #1d4ed8',
        paddingTop: '8px',
        marginTop: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '9px',
        color: '#94a3b8',
      }}>
        <div>
          <div style={{ fontWeight: '600', color: '#1d4ed8', fontSize: '10px' }}>
            Croma Print Comunicação Visual
          </div>
          <div style={{ marginTop: '2px' }}>
            {vendedor && aprovadoEm
              ? `Autorizado por: ${vendedor} em ${formatDate(aprovadoEm)}`
              : vendedor
                ? `Responsável: ${vendedor}`
                : `Emitido em: ${formatDate(new Date())}`
            }
          </div>
        </div>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          {mode === 'op' ? 'Ordem de Produção' : 'Ordem de Serviço'} — Nº {numero}
        </div>
        <div style={{ textAlign: 'right', color: '#94a3b8' }}>
          Emitido em {formatDate(new Date())}
        </div>
      </div>
    </div>
  );
}

export default OSPrintLayout;

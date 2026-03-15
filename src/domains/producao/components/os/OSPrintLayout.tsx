// OSPrintLayout — A4 print/PDF layout for Ordem de Serviço
// IMPORTANT: All styles MUST be inline (React CSSProperties).
// html2pdf.js renders off-screen without access to Tailwind classes.

import React, { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from '@/shared/utils/format';
import type { OSData, OSOPData, OSItem, OSEtapa } from '../../types/ordem-servico';
import { ETAPA_STATUS_ICON } from '../../types/ordem-servico';

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

function EtapasTimeline({ etapas }: { etapas: OSEtapa[] }) {
  if (!etapas || etapas.length === 0) return null;

  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={styles.sectionTitle}>Etapas de Produção</div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '0' }}>
        {sorted.map((etapa, idx) => {
          const isConcluida = etapa.status === 'concluida';
          const isAndamento = etapa.status === 'em_andamento';
          const icon = ETAPA_STATUS_ICON[etapa.status] ?? '⏳';
          const circleColor = isConcluida ? '#16a34a' : isAndamento ? '#2563eb' : '#94a3b8';
          const lineColor = isConcluida ? '#16a34a' : '#e2e8f0';

          return (
            <React.Fragment key={etapa.id}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '60px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: circleColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  color: '#ffffff',
                  border: `2px solid ${circleColor}`,
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '3px', textAlign: 'center' as const, maxWidth: '60px' }}>
                  {etapa.nome}
                </div>
                {etapa.tempo_estimado_min != null && (
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>
                    {etapa.tempo_estimado_min}min
                  </div>
                )}
              </div>
              {idx < sorted.length - 1 && (
                <div style={{
                  flex: '1',
                  height: '2px',
                  backgroundColor: lineColor,
                  minWidth: '12px',
                  marginBottom: '20px',
                }} />
              )}
            </React.Fragment>
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
    <div style={{ pageBreakInside: 'avoid', marginBottom: '10px' }}>
      {/* Item header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: '6px 8px',
        borderRadius: '4px',
        borderLeft: '3px solid #2563eb',
        marginBottom: '6px',
      }}>
        <div>
          <span style={{ fontWeight: '700', fontSize: '12px', color: '#1e293b' }}>
            Item {index + 1} — {item.descricao}
          </span>
          {item.modelo_nome && (
            <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '8px' }}>
              [{item.modelo_nome}]
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af' }}>
          Qtd: {item.quantidade} {item.unidade}
        </div>
      </div>

      {/* Dimensions + Acabamentos */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '4px', fontSize: '10px', color: '#475569' }}>
        {larguraM && alturaM && (
          <span>Dimensões: {larguraM}m × {alturaM}m{areaStr ? ` = ${areaStr} m²` : ''}</span>
        )}
        {item.acabamentos && item.acabamentos.length > 0 && (
          <span>Acabamentos: {item.acabamentos.join(', ')}</span>
        )}
        {item.op_numero && (
          <span style={{ color: '#7c3aed' }}>OP: {item.op_numero}</span>
        )}
      </div>

      {/* Especificação */}
      {item.especificacao && (
        <div style={{ fontSize: '10px', color: '#475569', marginBottom: '4px' }}>
          {item.especificacao}
        </div>
      )}

      {/* Instruções */}
      {item.instrucoes && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '4px',
          padding: '5px 8px',
          marginBottom: '6px',
          fontSize: '10px',
          color: '#92400e',
        }}>
          <strong>Instruções: </strong>{item.instrucoes}
        </div>
      )}

      {/* Materials table */}
      {item.materiais && item.materiais.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '10px',
          marginBottom: '4px',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                Material
              </th>
              <th style={{ textAlign: 'center', padding: '3px 6px', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '50px' }}>
                Unid
              </th>
              <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', width: '80px' }}>
                Consumo
              </th>
            </tr>
          </thead>
          <tbody>
            {item.materiais.map((mat) => (
              <tr key={mat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '3px 6px', color: '#1e293b' }}>{mat.nome}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', color: '#475569' }}>{mat.unidade}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#1e293b' }}>
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
      {/* HEADER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        {/* Left: Brand */}
        <div style={{ minWidth: '120px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8', letterSpacing: '-0.02em' }}>
            CROMA PRINT
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
            Comunicação Visual
          </div>
        </div>

        {/* Center: OS info */}
        <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
          <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.08em', marginBottom: '2px' }}>
            {mode === 'op' ? 'Ordem de Produção' : 'Ordem de Serviço'}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>
            Nº {numero}
          </div>
          <div style={{ marginTop: '4px' }}>
            <span style={{
              ...badgeStyle,
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '9999px',
              display: 'inline-block',
            }}>
              {statusLabel}
            </span>
          </div>
          {dataEntrega && (
            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600', marginTop: '3px' }}>
              Entrega: {formatDate(dataEntrega)}
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

      <div style={styles.separator} />

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
      {/* FOOTER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '9px', color: '#94a3b8', marginTop: '8px' }}>
        <div>
          {vendedor && aprovadoEm
            ? `Autorizado por: ${vendedor} em ${formatDate(aprovadoEm)}`
            : vendedor
              ? `Responsável: ${vendedor}`
              : `Emitido em: ${formatDate(new Date())}`
          }
        </div>
        <div style={{ fontWeight: '600', color: '#64748b' }}>
          Croma Print Comunicação Visual
        </div>
      </div>
    </div>
  );
}

export default OSPrintLayout;

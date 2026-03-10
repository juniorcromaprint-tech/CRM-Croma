// ============================================================================
// ORÇAMENTO PDF — Layout de impressão A4
// Componente otimizado para window.print() com estilos @media print
// ============================================================================

import { brl, formatDate, formatCNPJ } from "@/shared/utils/format";
import type {
  Orcamento,
  OrcamentoItem,
  OrcamentoItemMaterial,
  OrcamentoItemAcabamento,
  OrcamentoServico,
} from "../services/orcamento.service";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrcamentoPDFProps {
  orcamento: Orcamento & {
    itens: (OrcamentoItem & {
      materiais?: OrcamentoItemMaterial[];
      acabamentos?: OrcamentoItemAcabamento[];
    })[];
    servicos: OrcamentoServico[];
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcValidadeDate(createdAt: string, dias: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + dias);
  return formatDate(d);
}

function calcSubtotalItens(
  itens: OrcamentoPDFProps["orcamento"]["itens"],
): number {
  return itens.reduce((sum, item) => sum + item.valor_total, 0);
}

function calcSubtotalServicos(servicos: OrcamentoServico[]): number {
  return servicos.reduce((sum, s) => sum + s.valor_total, 0);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrcamentoPDF({ orcamento }: OrcamentoPDFProps) {
  const {
    numero,
    titulo,
    cliente,
    cliente_nome_snapshot,
    cliente_cnpj_snapshot,
    created_at,
    validade_dias,
    itens,
    servicos,
    subtotal,
    desconto_percentual,
    desconto_valor,
    total,
    condicoes_pagamento,
    observacoes,
  } = orcamento;

  const clienteNome =
    cliente?.nome_fantasia || cliente?.razao_social || cliente_nome_snapshot || "---";
  const clienteCnpj = cliente_cnpj_snapshot || null;

  const subtotalItens = calcSubtotalItens(itens);
  const subtotalServicos = calcSubtotalServicos(servicos);
  const hasServicos = servicos.length > 0;
  const hasDesconto = desconto_percentual > 0;

  return (
    <div
      className="
        mx-auto bg-white text-slate-800
        print:m-0 print:p-0 print:shadow-none print:bg-white
      "
      style={{
        maxWidth: "210mm",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontSize: "11px",
        lineHeight: "1.5",
      }}
    >
      {/* ── Print-only styles ───────────────────────────────────────────── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 15mm 12mm 15mm 12mm;
              }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .orcamento-pdf-page-break { break-before: page; }
            }
          `,
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          HEADER — Empresa + Título do documento
          ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: "12px",
          borderBottom: "3px solid #1e40af",
          marginBottom: "20px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "#1e40af",
              letterSpacing: "-0.02em",
            }}
          >
            CROMA PRINT
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
            Comunicação Visual
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#334155",
              letterSpacing: "0.02em",
            }}
          >
            PROPOSTA COMERCIAL
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#1e40af",
              fontWeight: 600,
              marginTop: "2px",
            }}
          >
            {numero}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          INFO BOX — Cliente + dados da proposta
          ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "14px 16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          {/* Coluna esquerda — Cliente */}
          <div>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              Cliente
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
              {clienteNome}
            </div>
            {clienteCnpj && (
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                CNPJ: {formatCNPJ(clienteCnpj)}
              </div>
            )}
          </div>

          {/* Coluna direita — Dados */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "2px",
                }}
              >
                Data
              </div>
              <div style={{ fontSize: "11px", color: "#334155" }}>
                {formatDate(created_at)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "2px",
                }}
              >
                Validade
              </div>
              <div style={{ fontSize: "11px", color: "#334155" }}>
                {validade_dias} dias ({calcValidadeDate(created_at, validade_dias)})
              </div>
            </div>
          </div>
        </div>

        {/* Titulo da proposta */}
        {titulo && (
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "2px",
              }}
            >
              Referência
            </div>
            <div style={{ fontSize: "11px", color: "#334155" }}>{titulo}</div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TABELA DE ITENS
          ══════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#1e293b",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "8px",
            paddingBottom: "4px",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          Itens
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f1f5f9",
                borderBottom: "1px solid #cbd5e1",
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#64748b",
                  width: "28px",
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#64748b",
                }}
              >
                Descrição
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#64748b",
                  width: "48px",
                }}
              >
                Qtd
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#64748b",
                  width: "85px",
                }}
              >
                Unitário
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#64748b",
                  width: "95px",
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <td
                  style={{
                    padding: "8px",
                    color: "#94a3b8",
                    verticalAlign: "top",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {idx + 1}
                </td>
                <td style={{ padding: "8px", verticalAlign: "top" }}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>
                    {item.descricao}
                  </div>
                  {item.especificacao && (
                    <div style={{ fontSize: "9px", color: "#64748b", marginTop: "1px" }}>
                      {item.especificacao}
                    </div>
                  )}
                  {item.largura_cm != null && item.altura_cm != null && (
                    <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "1px" }}>
                      {item.largura_cm} x {item.altura_cm} cm
                      {item.area_m2 != null && item.area_m2 > 0
                        ? ` \u00B7 ${item.area_m2.toFixed(2)} m\u00B2`
                        : ""}
                    </div>
                  )}
                  {/* Materiais */}
                  {item.materiais && item.materiais.length > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      {item.materiais.map((mat) => (
                        <div
                          key={mat.id}
                          style={{
                            fontSize: "9px",
                            color: "#64748b",
                            paddingLeft: "8px",
                            borderLeft: "2px solid #e2e8f0",
                            marginTop: "2px",
                          }}
                        >
                          {mat.descricao}
                          {mat.quantidade > 0 && (
                            <span style={{ color: "#94a3b8" }}>
                              {" "}&mdash; {mat.quantidade} {mat.unidade}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Acabamentos */}
                  {item.acabamentos && item.acabamentos.length > 0 && (
                    <div style={{ marginTop: "3px" }}>
                      {item.acabamentos.map((acab) => (
                        <div
                          key={acab.id}
                          style={{
                            fontSize: "9px",
                            color: "#64748b",
                            paddingLeft: "8px",
                            borderLeft: "2px solid #ddd6fe",
                            marginTop: "2px",
                          }}
                        >
                          {acab.descricao}
                          {acab.quantidade > 0 && (
                            <span style={{ color: "#94a3b8" }}>
                              {" "}&mdash; {acab.quantidade}x
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "right",
                    verticalAlign: "top",
                    color: "#334155",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.quantidade}
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "right",
                    verticalAlign: "top",
                    color: "#334155",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {brl(item.valor_unitario)}
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "right",
                    verticalAlign: "top",
                    fontWeight: 600,
                    color: "#1e293b",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {brl(item.valor_total)}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "20px 8px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  Nenhum item
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TABELA DE SERVIÇOS (condicional)
          ══════════════════════════════════════════════════════════════════ */}
      {hasServicos && (
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#1e293b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
              paddingBottom: "4px",
              borderBottom: "1px solid #cbd5e1",
            }}
          >
            Serviços
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#f1f5f9",
                  borderBottom: "1px solid #cbd5e1",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  Serviço
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#64748b",
                    width: "52px",
                  }}
                >
                  Horas
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#64748b",
                    width: "85px",
                  }}
                >
                  Valor/h
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#64748b",
                    width: "95px",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {servicos.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: "1px solid #e2e8f0" }}
                >
                  <td style={{ padding: "8px", color: "#1e293b", fontWeight: 500 }}>
                    {s.descricao}
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      color: "#334155",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.horas}h
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      color: "#334155",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {brl(s.valor_unitario)}/h
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#1e293b",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {brl(s.valor_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          RESUMO FINANCEIRO
          ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "260px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "12px 16px",
          }}
        >
          {/* Subtotal itens */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
              fontSize: "10px",
            }}
          >
            <span style={{ color: "#64748b" }}>Subtotal Itens</span>
            <span
              style={{
                color: "#334155",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {brl(subtotalItens)}
            </span>
          </div>

          {/* Subtotal servicos */}
          {hasServicos && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                fontSize: "10px",
              }}
            >
              <span style={{ color: "#64748b" }}>Serviços</span>
              <span
                style={{
                  color: "#334155",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {brl(subtotalServicos)}
              </span>
            </div>
          )}

          {/* Desconto */}
          {hasDesconto && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                fontSize: "10px",
              }}
            >
              <span style={{ color: "#dc2626" }}>
                Desconto ({desconto_percentual}%)
              </span>
              <span
                style={{
                  color: "#dc2626",
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                -{brl(desconto_valor)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              borderTop: "2px solid #1e40af",
              margin: "8px 0",
            }}
          />

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              TOTAL
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "#1e40af",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {brl(total)}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CONDIÇÕES DE PAGAMENTO
          ══════════════════════════════════════════════════════════════════ */}
      {condicoes_pagamento && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#1e293b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "4px",
              paddingBottom: "4px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            Condições de Pagamento
          </div>
          <div style={{ fontSize: "10px", color: "#334155", lineHeight: "1.6" }}>
            {condicoes_pagamento}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          OBSERVAÇÕES
          ══════════════════════════════════════════════════════════════════ */}
      {observacoes && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#1e293b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "4px",
              paddingBottom: "4px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            Observações
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#334155",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
            }}
          >
            {observacoes}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          RODAPÉ
          ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          borderTop: "2px solid #1e40af",
          paddingTop: "10px",
          marginTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          fontSize: "9px",
          color: "#94a3b8",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: "#1e40af", fontSize: "10px" }}>
            Croma Print Comunicação Visual
          </div>
          <div style={{ marginTop: "2px" }}>
            Proposta {numero}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Proposta válida por {validade_dias} dias</div>
          <div style={{ marginTop: "2px" }}>
            Emitida em {formatDate(created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ORÇAMENTO PDF MULTI-MODO — v2.0 (premium)
// Renderiza a mesma proposta em 3 modos distintos:
//  - cliente   → proposta comercial premium (header completo, itens consolidados,
//                condições de pagamento detalhadas, local de instalação separado)
//  - producao  → ordem de produção para o chão de fábrica (materiais, processos,
//                tempo estimado, SEM valores — máquina, substrato, equipe)
//  - tecnico   → ficha técnica interna (custos reais MP/MO/Fixo, markup, margem,
//                comissões vendedor + externa, tempo de produção, SEM materiais)
//
// Desenhado para rodar através do html2pdf.js (jsPDF + html2canvas scale:2).
// Margens externas do PDF são aplicadas pelo html2pdf via option 'margin'.
// A área útil é ~190×277mm em A4 com margem 10mm — todas as tabelas respeitam
// essa largura e evitam quebras horizontais.
// ============================================================================

import {
  brl,
  formatArea,
  formatCEP,
  formatCNPJ,
  formatDate,
  formatNumber,
  formatPhone,
} from "@/shared/utils/format";
import { CROMA_LOGO_BASE64 } from "@/shared/constants/logo";
import type {
  Orcamento,
  OrcamentoItem,
  OrcamentoItemMaterial,
  OrcamentoItemAcabamento,
  OrcamentoServico,
} from "../services/orcamento.service";
import type { OrcamentoEnriquecidoPDF } from "../services/orcamento-pdf-enrich.service";
import { formatMinutos } from "../services/orcamento-pdf-enrich.service";

export type ModoPDF = "cliente" | "producao" | "tecnico";

type ItemExtendido = OrcamentoItem & {
  materiais?: OrcamentoItemMaterial[];
  acabamentos?: OrcamentoItemAcabamento[];
  arte_url?: string | null;
  arte_preview_url?: string | null;
};

interface Props {
  orcamento: Orcamento & {
    itens: ItemExtendido[];
    servicos: OrcamentoServico[];
    vendedor_nome?: string | null;
    vendedor_comissao_pct?: number | null;
    forma_pagamento?: string | null;
    parcelas_count?: number | null;
    prazo_dias?: number[] | null;
    descricao?: string | null;
    observacoes?: string | null;
  };
  modo: ModoPDF;
  nomeEmpresa?: string;
  /** Dados extras carregados via enriquecerOrcamentoParaPDF. */
  enriched?: OrcamentoEnriquecidoPDF | null;
}

// ─── Configuração visual por modo ───────────────────────────────────────────

const MODO_CONFIG: Record<
  ModoPDF,
  { titulo: string; cor: string; subtitulo: string }
> = {
  cliente: {
    titulo: "Proposta Comercial",
    cor: "#1e40af", // azul profundo
    subtitulo: "Comunicação Visual Profissional",
  },
  producao: {
    titulo: "Ordem de Produção",
    cor: "#0f766e", // verde petróleo
    subtitulo: "Chão de Fábrica — Execução",
  },
  tecnico: {
    titulo: "Ficha Técnica Interna",
    cor: "#6d28d9", // roxo profundo
    subtitulo: "Uso comercial / financeiro — NÃO enviar ao cliente",
  },
};

// ─── Helpers de dados ───────────────────────────────────────────────────────

function resolveClienteNome(
  orc: Props["orcamento"],
  enriched: OrcamentoEnriquecidoPDF | null,
): string {
  return (
    enriched?.cliente?.nome_fantasia ||
    enriched?.cliente?.razao_social ||
    (orc as any).cliente?.nome_fantasia ||
    (orc as any).cliente?.razao_social ||
    orc.cliente_nome_snapshot ||
    "—"
  );
}

function resolveClienteRazao(
  orc: Props["orcamento"],
  enriched: OrcamentoEnriquecidoPDF | null,
): string | null {
  return (
    enriched?.cliente?.razao_social ||
    (orc as any).cliente?.razao_social ||
    orc.cliente_nome_snapshot ||
    null
  );
}

function resolveClienteCnpj(
  orc: Props["orcamento"],
  enriched: OrcamentoEnriquecidoPDF | null,
): string | null {
  return (
    enriched?.cliente?.cnpj ||
    (orc as any).cliente?.cnpj ||
    orc.cliente_cnpj_snapshot ||
    null
  );
}

function resolveEnderecoCliente(
  enriched: OrcamentoEnriquecidoPDF | null,
): string | null {
  const c = enriched?.cliente;
  if (!c) return null;
  const pedacos: string[] = [];
  if (c.endereco) {
    pedacos.push(c.numero ? `${c.endereco}, ${c.numero}` : c.endereco);
  }
  if (c.complemento) pedacos.push(c.complemento);
  if (c.bairro) pedacos.push(c.bairro);
  if (c.cidade && c.estado) pedacos.push(`${c.cidade}/${c.estado}`);
  else if (c.cidade) pedacos.push(c.cidade);
  if (c.cep) pedacos.push(`CEP ${formatCEP(c.cep)}`);
  return pedacos.length > 0 ? pedacos.join(" · ") : null;
}

function calcSubtotalItens(itens: ItemExtendido[]): number {
  return itens.reduce((sum, i) => sum + (i.valor_total || 0), 0);
}

function calcSubtotalServicos(servicos: OrcamentoServico[]): number {
  return (servicos ?? []).reduce((s, x) => s + (x.valor_total || 0), 0);
}

/**
 * Valor por m² correto: quando a unidade é "m²" ou quando quantidade == area_m2
 * (caso comum do Mubisys, em que a "qtd" é a própria área), usar valor_unitario.
 * Caso contrário, valor_total / area_m2 (independente da qtd).
 */
function calcValorM2(item: ItemExtendido): number | null {
  const area = Number(item.area_m2 || 0);
  if (area <= 0) return null;
  const qtd = Number(item.quantidade || 0);
  const unidade = (item.unidade || "").toLowerCase();
  if (unidade === "m²" || unidade === "m2") return Number(item.valor_unitario || 0);
  if (qtd > 0 && Math.abs(qtd - area) < 0.001) return Number(item.valor_unitario || 0);
  // fallback seguro: total / area
  return (Number(item.valor_total || 0)) / area;
}

function formatDimensoesMetros(item: ItemExtendido): string | null {
  const l = Number(item.largura_cm || 0);
  const a = Number(item.altura_cm || 0);
  if (l <= 0 && a <= 0) return null;
  const lm = (l / 100).toFixed(2).replace(".", ",");
  const am = (a / 100).toFixed(2).replace(".", ",");
  if (l > 0 && a > 0) return `${lm} × ${am} m`;
  if (l > 0) return `${lm} m`;
  return `${am} m`;
}

function formatQtdComUnidade(item: ItemExtendido): string {
  const qtd = Number(item.quantidade || 0);
  const unidade = (item.unidade || "un").trim();
  const u = unidade.toLowerCase();
  if (u === "m²" || u === "m2") return `${formatNumber(qtd)} m²`;
  // qtd inteira vs decimal
  if (Number.isInteger(qtd)) return `${qtd} ${unidade}`;
  return `${formatNumber(qtd)} ${unidade}`;
}

function totalMateriaisItem(item: ItemExtendido): number {
  return (item.materiais ?? []).reduce((s, m) => s + (m.custo_total || 0), 0);
}

function totalAcabamentosItem(item: ItemExtendido): number {
  return (item.acabamentos ?? []).reduce((s, a) => s + (a.custo_total || 0), 0);
}

function calcCustoTotalItem(item: ItemExtendido): number {
  return (
    Number(item.custo_mp || 0) +
    Number(item.custo_mo || 0) +
    Number(item.custo_fixo || 0) +
    totalMateriaisItem(item) +
    totalAcabamentosItem(item)
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function OrcamentoPDFMulti({
  orcamento,
  modo,
  nomeEmpresa = "Croma Print Comunicação Visual",
  enriched = null,
}: Props) {
  const cfg = MODO_CONFIG[modo];
  const itensVisiveis = (orcamento.itens ?? []).filter(
    (i) => i.item_visivel !== false,
  );
  const subtotalItens = calcSubtotalItens(itensVisiveis);
  const subtotalServicos = calcSubtotalServicos(orcamento.servicos ?? []);
  const subtotal = orcamento.subtotal || subtotalItens + subtotalServicos;
  const desconto = Number(orcamento.desconto_valor || 0);
  const total = orcamento.total || subtotal - desconto;

  const clienteNome = resolveClienteNome(orcamento, enriched);
  const clienteRazao = resolveClienteRazao(orcamento, enriched);
  const clienteCnpj = resolveClienteCnpj(orcamento, enriched);
  const clienteEnd = resolveEnderecoCliente(enriched);
  const clienteIE = enriched?.cliente?.inscricao_estadual ?? null;
  const clienteTel = enriched?.cliente?.telefone ?? null;
  const clienteEmail = enriched?.cliente?.email ?? null;
  const clienteContatoFin = enriched?.cliente?.contato_financeiro ?? null;

  const local = enriched?.local_instalacao ?? null;
  const obsLimpas = enriched?.observacoes_limpas ?? null;

  return (
    <div
      className="orcamento-pdf-multi"
      style={{
        width: "190mm",
        padding: "0",
        background: "white",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        fontSize: "9.5pt",
        color: "#0f172a",
        lineHeight: 1.38,
      }}
    >
      <style>{`
        .orcamento-pdf-multi h1,
        .orcamento-pdf-multi h2,
        .orcamento-pdf-multi h3,
        .orcamento-pdf-multi p { margin: 0; padding: 0; }
        .orcamento-pdf-multi table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .orcamento-pdf-multi td,
        .orcamento-pdf-multi th {
          padding: 5px 7px;
          font-size: 8.8pt;
          vertical-align: top;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .orcamento-pdf-multi thead th {
          background: ${cfg.cor};
          color: white;
          font-weight: 600;
          text-align: left;
          font-size: 8.4pt;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .orcamento-pdf-multi tbody tr {
          border-bottom: 1px solid #e2e8f0;
        }
        .orcamento-pdf-multi tbody tr:nth-child(even) { background: #f8fafc; }
        .orcamento-pdf-multi .secao-titulo {
          font-size: 9.5pt;
          font-weight: 700;
          color: ${cfg.cor};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 12px 0 6px 0;
          padding-bottom: 3px;
          border-bottom: 1.5px solid ${cfg.cor};
        }
        .orcamento-pdf-multi .card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 3px solid ${cfg.cor};
          border-radius: 6px;
          padding: 8px 11px;
          margin-top: 6px;
        }
        .orcamento-pdf-multi .kv {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 3px 10px;
          font-size: 8.8pt;
        }
        .orcamento-pdf-multi .kv dt {
          color: #64748b;
          font-weight: 500;
        }
        .orcamento-pdf-multi .kv dd {
          margin: 0;
          color: #0f172a;
        }
        .orcamento-pdf-multi .thumb {
          width: 68px; height: 68px; object-fit: cover;
          border-radius: 5px; border: 1px solid #e2e8f0;
          background: #f1f5f9; display: block;
        }
        .orcamento-pdf-multi .thumb-sem {
          width: 68px; height: 68px;
          border-radius: 5px; border: 1px dashed #cbd5e1;
          background: #f8fafc; display: flex;
          align-items: center; justify-content: center;
          color: #94a3b8; font-size: 7.5pt; text-align: center;
        }
        .orcamento-pdf-multi .total-box {
          margin-top: 10px; padding: 10px 14px;
          background: ${cfg.cor}; color: white;
          border-radius: 6px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .orcamento-pdf-multi .warn {
          background: #fef3c7; border-left: 3px solid #d97706;
          padding: 8px 11px; border-radius: 5px; margin-top: 8px;
          font-size: 8.5pt; color: #78350f;
        }
        .orcamento-pdf-multi .foot {
          margin-top: 18px; padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          font-size: 7.6pt; color: #64748b; text-align: center;
          line-height: 1.4;
        }
        .orcamento-pdf-multi .badge-interno {
          display: inline-block;
          background: #fef3c7; color: #78350f;
          padding: 2px 8px; border-radius: 3px;
          font-size: 7.6pt; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .orcamento-pdf-multi ul.lista-limpa {
          margin: 2px 0 0 0; padding-left: 15px;
          font-size: 8.4pt; color: #475569;
        }
        .orcamento-pdf-multi ul.lista-limpa li { margin: 1px 0; }
      `}</style>

      {/* ═══════════ HEADER ═══════════ */}
      <Header
        cor={cfg.cor}
        titulo={cfg.titulo}
        subtitulo={cfg.subtitulo}
        nomeEmpresa={nomeEmpresa}
        orcamento={orcamento}
        modo={modo}
      />

      {/* Aviso discreto apenas no modo técnico */}
      {modo === "tecnico" && (
        <div style={{ marginTop: 8 }}>
          <span className="badge-interno">Documento interno</span>
        </div>
      )}

      {/* ═══════════ CLIENTE ═══════════ */}
      <h2 className="secao-titulo">Dados do Cliente</h2>
      <table style={{ marginTop: 4 }}>
        <colgroup>
          <col style={{ width: "55%" }} />
          <col style={{ width: "45%" }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ borderBottom: "none" }}>
              <div style={{ fontSize: "10pt", fontWeight: 700, color: "#0f172a" }}>
                {clienteRazao || clienteNome}
              </div>
              {clienteRazao && clienteNome && clienteRazao !== clienteNome && (
                <div style={{ fontSize: "8.6pt", color: "#64748b" }}>{clienteNome}</div>
              )}
              {clienteCnpj && (
                <div style={{ fontSize: "8.4pt", color: "#475569", marginTop: 2 }}>
                  CNPJ: <strong>{formatCNPJ(clienteCnpj)}</strong>
                  {clienteIE && (
                    <span style={{ marginLeft: 8 }}>
                      IE: <strong>{clienteIE}</strong>
                    </span>
                  )}
                </div>
              )}
              {clienteEnd && (
                <div style={{ fontSize: "8.2pt", color: "#64748b", marginTop: 3 }}>
                  {clienteEnd}
                </div>
              )}
            </td>
            <td style={{ borderBottom: "none" }}>
              {clienteTel && (
                <div style={{ fontSize: "8.4pt" }}>
                  <span style={{ color: "#64748b" }}>Telefone: </span>
                  {formatPhone(clienteTel)}
                </div>
              )}
              {clienteEmail && (
                <div style={{ fontSize: "8.4pt" }}>
                  <span style={{ color: "#64748b" }}>E-mail: </span>
                  {clienteEmail}
                </div>
              )}
              {clienteContatoFin && (
                <div style={{ fontSize: "8.4pt", marginTop: 2 }}>
                  <span style={{ color: "#64748b" }}>Contato: </span>
                  {clienteContatoFin}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ═══════════ LOCAL DE INSTALAÇÃO / REFERÊNCIA ═══════════ */}
      {local && (
        <>
          <h2 className="secao-titulo">
            {modo === "producao"
              ? "Local de Aplicação"
              : "Local de Instalação"}
          </h2>
          <div className="card">
            <dl className="kv">
              {local.referencia && (
                <>
                  <dt>Referência</dt>
                  <dd>
                    <strong>{local.referencia}</strong>
                  </dd>
                </>
              )}
              {local.marca && (
                <>
                  <dt>Marca atendida</dt>
                  <dd>{local.marca}</dd>
                </>
              )}
              {local.endereco_completo && (
                <>
                  <dt>Endereço</dt>
                  <dd>{local.endereco_completo}</dd>
                </>
              )}
              {local.responsavel && (
                <>
                  <dt>Responsável local</dt>
                  <dd>{local.responsavel}</dd>
                </>
              )}
              {(local.contato_nome || local.contato_telefone) && (
                <>
                  <dt>Contato</dt>
                  <dd>
                    {local.contato_nome}
                    {local.contato_telefone &&
                      ` — ${local.contato_telefone}`}
                  </dd>
                </>
              )}
              {local.condicoes_locais && modo !== "tecnico" && (
                <>
                  <dt>Condições no local</dt>
                  <dd>{local.condicoes_locais}</dd>
                </>
              )}
            </dl>
          </div>
        </>
      )}

      {/* ═══════════ DESCRIÇÃO (apenas cliente) ═══════════ */}
      {modo === "cliente" && orcamento.descricao && orcamento.descricao.trim() && (
        <>
          <h2 className="secao-titulo">Escopo da Proposta</h2>
          <p style={{ fontSize: "8.8pt", color: "#334155", whiteSpace: "pre-line" }}>
            {orcamento.descricao}
          </p>
        </>
      )}

      {/* ═══════════ ITENS ═══════════ */}
      <h2 className="secao-titulo">
        {modo === "producao" ? "Itens a Produzir" : "Itens"}
      </h2>
      {modo === "cliente" && (
        <TabelaItensCliente itens={itensVisiveis} cor={cfg.cor} />
      )}
      {modo === "producao" && (
        <TabelaItensProducao
          itens={itensVisiveis}
          enriched={enriched}
          cor={cfg.cor}
        />
      )}
      {modo === "tecnico" && (
        <TabelaItensTecnico itens={itensVisiveis} cor={cfg.cor} />
      )}

      {/* Serviços extras (apenas se existirem — modo cliente e técnico) */}
      {modo !== "producao" && orcamento.servicos && orcamento.servicos.length > 0 && (
        <>
          <h2 className="secao-titulo">Serviços</h2>
          <table>
            <colgroup>
              <col style={{ width: "60%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style={{ textAlign: "center" }}>Horas</th>
                <th style={{ textAlign: "right" }}>Valor/h</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orcamento.servicos.map((s) => (
                <tr key={s.id}>
                  <td>{s.descricao}</td>
                  <td style={{ textAlign: "center" }}>{formatNumber(s.horas)}</td>
                  <td style={{ textAlign: "right" }}>{brl(s.valor_unitario)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {brl(s.valor_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ═══════════ TOTAIS ═══════════ */}
      {(modo === "cliente" || modo === "tecnico") && (
        <section style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: "60%" }}>
              <table style={{ fontSize: "9pt" }}>
                <colgroup>
                  <col />
                  <col style={{ width: "40%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "right", color: "#64748b", borderBottom: "none" }}>
                      Subtotal
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        borderBottom: "none",
                      }}
                    >
                      {brl(subtotal)}
                    </td>
                  </tr>
                  {desconto > 0 && (
                    <tr>
                      <td
                        style={{
                          textAlign: "right",
                          color: "#dc2626",
                          borderBottom: "none",
                        }}
                      >
                        Desconto
                        {orcamento.desconto_percentual
                          ? ` (${formatNumber(orcamento.desconto_percentual)}%)`
                          : ""}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: "#dc2626",
                          borderBottom: "none",
                        }}
                      >
                        − {brl(desconto)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="total-box">
                <span style={{ fontSize: "10pt", fontWeight: 600, letterSpacing: "0.02em" }}>
                  TOTAL GERAL
                </span>
                <span style={{ fontSize: "13pt", fontWeight: 700 }}>{brl(total)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ CONDIÇÕES DE PAGAMENTO (cliente) ═══════════ */}
      {modo === "cliente" && (
        <>
          <h2 className="secao-titulo">Condições Comerciais</h2>
          <CondicoesClienteCard orcamento={orcamento} local={local} />
        </>
      )}

      {/* ═══════════ DADOS DE PAGAMENTO (cliente) ═══════════ */}
      {modo === "cliente" && (
        <>
          <h2 className="secao-titulo">Dados para Pagamento</h2>
          <div className="card" style={{ background: "#eef2ff", borderLeftColor: "#4338ca" }}>
            <dl className="kv">
              <dt>PIX (CNPJ)</dt>
              <dd>
                <strong>18.923.994/0001-83</strong> — Croma Print Comunicação Visual
              </dd>
              <dt>E-mail oficial</dt>
              <dd>junior@cromaprint.com.br</dd>
              <dt>Formas aceitas</dt>
              <dd>PIX, transferência bancária ou boleto</dd>
            </dl>
          </div>
        </>
      )}

      {/* ═══════════ OBSERVAÇÕES (cliente) ═══════════ */}
      {modo === "cliente" && obsLimpas && (
        <>
          <h2 className="secao-titulo">Observações</h2>
          <p
            style={{
              fontSize: "8.6pt",
              color: "#334155",
              whiteSpace: "pre-line",
              padding: "6px 0",
            }}
          >
            {obsLimpas}
          </p>
        </>
      )}

      {/* ═══════════ PRODUÇÃO: OS específica ═══════════ */}
      {modo === "producao" && (
        <ProducaoExtras
          orcamento={orcamento}
          itens={itensVisiveis}
          enriched={enriched}
          cor={cfg.cor}
        />
      )}

      {/* ═══════════ TÉCNICO: ficha interna ═══════════ */}
      {modo === "tecnico" && (
        <FichaTecnicaExtras
          orcamento={orcamento}
          itens={itensVisiveis}
          enriched={enriched}
          subtotal={subtotal}
          total={total}
          cor={cfg.cor}
        />
      )}

      {/* ═══════════ FOOTER ═══════════ */}
      <div className="foot">
        <strong>{nomeEmpresa}</strong> · CNPJ 18.923.994/0001-83 ·
        junior@cromaprint.com.br · São Paulo/SP
        <br />
        {cfg.titulo} · Emitida em {formatDate(orcamento.created_at)} ·
        Proposta {orcamento.numero}
      </div>
    </div>
  );
}

// ═══════════ SUBCOMPONENTES ══════════════════════════════════════════════════

function Header({
  cor,
  titulo,
  subtitulo,
  nomeEmpresa,
  orcamento,
  modo,
}: {
  cor: string;
  titulo: string;
  subtitulo: string;
  nomeEmpresa: string;
  orcamento: Props["orcamento"];
  modo: ModoPDF;
}) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingBottom: 10,
        borderBottom: `3px solid ${cor}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <img
          src={CROMA_LOGO_BASE64}
          alt="Croma Print"
          style={{ height: 44, marginBottom: 4 }}
          crossOrigin="anonymous"
        />
        <div style={{ fontSize: "7.8pt", color: "#64748b", lineHeight: 1.4 }}>
          <strong style={{ color: "#334155" }}>{nomeEmpresa}</strong>
          <br />
          CNPJ 18.923.994/0001-83 · São Paulo/SP
          <br />
          junior@cromaprint.com.br · www.cromaprint.com.br
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 170 }}>
        <div
          style={{
            fontSize: "14pt",
            fontWeight: 700,
            color: cor,
            lineHeight: 1.1,
          }}
        >
          {titulo}
        </div>
        <div style={{ fontSize: "7.8pt", color: "#64748b", marginTop: 2 }}>
          {subtitulo}
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "5px 10px",
            background: cor,
            color: "white",
            borderRadius: 4,
            fontSize: "11pt",
            fontWeight: 700,
            display: "inline-block",
          }}
        >
          {orcamento.numero}
        </div>
        <div style={{ fontSize: "7.8pt", color: "#64748b", marginTop: 4 }}>
          Emitida em {formatDate(orcamento.created_at)}
          {modo === "cliente" && orcamento.validade_dias && (
            <>
              <br />Válida por {orcamento.validade_dias} dias
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ThumbArte({ item }: { item: ItemExtendido }) {
  const url = item.arte_preview_url || item.arte_url;
  if (!url) {
    return <div className="thumb-sem">sem<br />arte</div>;
  }
  return (
    <img
      src={url}
      alt="Arte do item"
      className="thumb"
      crossOrigin="anonymous"
    />
  );
}

// ── Tabela de itens — modo CLIENTE ──
function TabelaItensCliente({
  itens,
  cor: _cor,
}: {
  itens: ItemExtendido[];
  cor: string;
}) {
  return (
    <table>
      <colgroup>
        <col style={{ width: "12%" }} />
        <col style={{ width: "42%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "11%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Arte</th>
          <th>Descrição</th>
          <th>Medida</th>
          <th style={{ textAlign: "center" }}>Qtd</th>
          <th style={{ textAlign: "right" }}>Valor un.</th>
          <th style={{ textAlign: "right" }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => {
          const dim = formatDimensoesMetros(item);
          return (
            <tr key={item.id}>
              <td>
                <ThumbArte item={item} />
              </td>
              <td>
                <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "8.8pt" }}>
                  {item.nome_exibicao || item.descricao}
                </div>
                {item.especificacao && (
                  <div
                    style={{ color: "#64748b", fontSize: "8pt", marginTop: 2 }}
                  >
                    {item.especificacao}
                  </div>
                )}
              </td>
              <td style={{ fontSize: "8.4pt" }}>
                {dim || "—"}
                {item.area_m2 && Number(item.area_m2) > 0 && (
                  <div style={{ color: "#64748b", fontSize: "7.8pt" }}>
                    {formatArea(Number(item.area_m2))}
                  </div>
                )}
              </td>
              <td style={{ textAlign: "center" }}>
                {formatQtdComUnidade(item)}
              </td>
              <td style={{ textAlign: "right" }}>{brl(item.valor_unitario || 0)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {brl(item.valor_total || 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Tabela de itens — modo PRODUÇÃO ──
function TabelaItensProducao({
  itens,
  enriched,
  cor: _cor,
}: {
  itens: ItemExtendido[];
  enriched: OrcamentoEnriquecidoPDF | null;
  cor: string;
}) {
  return (
    <table>
      <colgroup>
        <col style={{ width: "12%" }} />
        <col style={{ width: "58%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "8%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Arte</th>
          <th>Item & especificação</th>
          <th>Medida</th>
          <th style={{ textAlign: "center" }}>Qtd</th>
          <th style={{ textAlign: "center" }}>m²</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => {
          const processos = enriched?.processos_por_item[item.id] ?? [];
          const dim = formatDimensoesMetros(item);
          return (
            <tr key={item.id}>
              <td>
                <ThumbArte item={item} />
              </td>
              <td>
                <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "8.8pt" }}>
                  {item.descricao}
                </div>
                {item.especificacao && (
                  <div style={{ color: "#475569", fontSize: "8pt", marginTop: 2 }}>
                    {item.especificacao}
                  </div>
                )}
                {item.materiais && item.materiais.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontSize: "7.4pt",
                        fontWeight: 700,
                        color: "#0f766e",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Matéria-prima
                    </div>
                    <ul className="lista-limpa">
                      {item.materiais.map((m) => (
                        <li key={m.id}>
                          {m.descricao}
                          {m.quantidade
                            ? ` — ${formatNumber(Number(m.quantidade))} ${m.unidade || ""}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.acabamentos && item.acabamentos.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontSize: "7.4pt",
                        fontWeight: 700,
                        color: "#b45309",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Acabamentos
                    </div>
                    <ul className="lista-limpa">
                      {item.acabamentos.map((a) => (
                        <li key={a.id}>
                          {a.descricao}
                          {a.quantidade && Number(a.quantidade) > 1
                            ? ` (x${a.quantidade})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {processos.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        fontSize: "7.4pt",
                        fontWeight: 700,
                        color: "#0369a1",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Processos
                    </div>
                    <ul className="lista-limpa">
                      {processos.map((p, idx) => (
                        <li key={`${item.id}-${idx}`}>
                          {p.etapa} — {formatMinutos(p.tempo_minutos)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </td>
              <td style={{ fontSize: "8.4pt" }}>{dim || "—"}</td>
              <td style={{ textAlign: "center" }}>
                {formatQtdComUnidade(item)}
              </td>
              <td style={{ textAlign: "center" }}>
                {item.area_m2 && Number(item.area_m2) > 0
                  ? formatNumber(Number(item.area_m2))
                  : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Tabela de itens — modo TÉCNICO ──
function TabelaItensTecnico({
  itens,
  cor: _cor,
}: {
  itens: ItemExtendido[];
  cor: string;
}) {
  return (
    <table>
      <colgroup>
        <col style={{ width: "32%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "13%" }} />
        <col style={{ width: "13%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Item</th>
          <th>Medida</th>
          <th style={{ textAlign: "center" }}>Qtd</th>
          <th style={{ textAlign: "right" }}>Custo</th>
          <th style={{ textAlign: "right" }}>Markup</th>
          <th style={{ textAlign: "right" }}>Valor/m²</th>
          <th style={{ textAlign: "right" }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => {
          const dim = formatDimensoesMetros(item);
          const custoTotal = calcCustoTotalItem(item);
          const valorM2 = calcValorM2(item);
          return (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 600, fontSize: "8.6pt" }}>
                  {item.descricao}
                </div>
                {item.especificacao && (
                  <div style={{ color: "#64748b", fontSize: "7.8pt", marginTop: 1 }}>
                    {item.especificacao}
                  </div>
                )}
              </td>
              <td style={{ fontSize: "8pt" }}>{dim || "—"}</td>
              <td style={{ textAlign: "center", fontSize: "8pt" }}>
                {formatQtdComUnidade(item)}
              </td>
              <td style={{ textAlign: "right", fontSize: "8pt" }}>
                {custoTotal > 0 ? brl(custoTotal) : "—"}
              </td>
              <td style={{ textAlign: "right", fontSize: "8pt" }}>
                {item.markup_percentual != null
                  ? `${formatNumber(Number(item.markup_percentual))}%`
                  : "—"}
              </td>
              <td style={{ textAlign: "right", fontSize: "8pt" }}>
                {valorM2 != null ? brl(valorM2) : "—"}
              </td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>
                {brl(item.valor_total || 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Condições comerciais — bloco cliente ──
function CondicoesClienteCard({
  orcamento,
  local,
}: {
  orcamento: Props["orcamento"];
  local: OrcamentoEnriquecidoPDF["local_instalacao"] | null;
}) {
  const forma = orcamento.forma_pagamento || null;
  const parcelas = orcamento.parcelas_count || null;
  const cond = orcamento.condicoes_pagamento || null;
  const validade = orcamento.validade_dias || null;
  const prazos = orcamento.prazo_dias && orcamento.prazo_dias.length > 0
    ? orcamento.prazo_dias
    : null;

  return (
    <div className="card">
      <dl className="kv">
        {cond && (
          <>
            <dt>Condições</dt>
            <dd>
              <strong>{cond}</strong>
            </dd>
          </>
        )}
        {!cond && forma && (
          <>
            <dt>Forma de pagamento</dt>
            <dd>
              <strong>{labelFormaPagamento(forma)}</strong>
              {parcelas && parcelas > 1 ? ` em ${parcelas}x` : ""}
              {prazos && ` (vencimento em ${prazos.join(", ")} dias)`}
            </dd>
          </>
        )}
        {validade && (
          <>
            <dt>Validade da proposta</dt>
            <dd>{validade} dias</dd>
          </>
        )}
        <dt>Logística</dt>
        <dd>
          {local?.endereco_completo
            ? "Produção na Croma Print + instalação no endereço acima"
            : "Entrega conforme combinado"}
        </dd>
        <dt>Prazo de entrega</dt>
        <dd>A combinar conforme aprovação e logística</dd>
      </dl>
    </div>
  );
}

function labelFormaPagamento(f: string): string {
  const k = f.toLowerCase();
  if (k === "pix") return "PIX";
  if (k === "boleto") return "Boleto bancário";
  if (k === "cartao" || k === "cartão") return "Cartão";
  if (k === "transferencia" || k === "transferência") return "Transferência bancária";
  if (k === "dinheiro") return "Dinheiro";
  return f;
}

// ── Extras do modo PRODUÇÃO ──
function ProducaoExtras({
  orcamento,
  itens,
  enriched,
  cor,
}: {
  orcamento: Props["orcamento"];
  itens: ItemExtendido[];
  enriched: OrcamentoEnriquecidoPDF | null;
  cor: string;
}) {
  const tempoTotal = enriched?.tempo_producao_total_min ?? 0;
  const tempoPorEtapa = enriched?.tempo_por_etapa ?? {};
  const prazoProducao = Math.max(
    ...itens.map((i) => Number(i.prazo_producao_dias || 0)),
    0,
  );

  // Substrato & máquina a partir dos materiais (heurística)
  const substratos = new Set<string>();
  const processos = new Set<string>();
  for (const item of itens) {
    for (const m of item.materiais ?? []) {
      const d = (m.descricao || "").toLowerCase();
      if (d.includes("vinil") || d.includes("lona") || d.includes("placa") ||
          d.includes("chapa") || d.includes("acm") || d.includes("adesivo"))
        substratos.add(m.descricao);
    }
    for (const a of item.acabamentos ?? []) {
      processos.add(a.descricao);
    }
  }

  return (
    <>
      <h2 className="secao-titulo">Tempo Estimado de Produção</h2>
      {tempoTotal > 0 ? (
        <table>
          <colgroup>
            <col style={{ width: "65%" }} />
            <col style={{ width: "35%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Etapa</th>
              <th style={{ textAlign: "right" }}>Tempo</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(tempoPorEtapa).map(([etapa, min]) => (
              <tr key={etapa}>
                <td>{etapa}</td>
                <td style={{ textAlign: "right" }}>{formatMinutos(min)}</td>
              </tr>
            ))}
            <tr>
              <td
                style={{
                  fontWeight: 700,
                  color: cor,
                  borderTop: `2px solid ${cor}`,
                }}
              >
                Tempo total estimado
              </td>
              <td
                style={{
                  fontWeight: 700,
                  textAlign: "right",
                  color: cor,
                  borderTop: `2px solid ${cor}`,
                }}
              >
                {formatMinutos(tempoTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: "8.4pt", color: "#94a3b8" }}>
          Tempo não cadastrado nos processos dos itens.
        </p>
      )}

      <h2 className="secao-titulo">Configuração da OP</h2>
      <div className="card">
        <dl className="kv">
          <dt>Máquina sugerida</dt>
          <dd>HP Latex 365 (impressão digital grande formato)</dd>
          {substratos.size > 0 && (
            <>
              <dt>Substratos</dt>
              <dd>{Array.from(substratos).join(" · ")}</dd>
            </>
          )}
          {processos.size > 0 && (
            <>
              <dt>Acabamentos</dt>
              <dd>{Array.from(processos).join(" · ")}</dd>
            </>
          )}
          <dt>Prazo de produção</dt>
          <dd>
            {prazoProducao > 0
              ? `${prazoProducao} dia${prazoProducao > 1 ? "s" : ""} úteis`
              : "A definir pelo PCP"}
          </dd>
          <dt>Equipe designada</dt>
          <dd style={{ color: "#94a3b8" }}>A atribuir pelo PCP</dd>
        </dl>
      </div>

      <h2 className="secao-titulo">Checklist de Qualidade</h2>
      <div className="card">
        <ul className="lista-limpa" style={{ fontSize: "8.4pt", color: "#334155" }}>
          <li>☐ Arte aprovada pelo cliente (versão final)</li>
          <li>☐ Teste de cor e calibração da HP Latex conferidos</li>
          <li>☐ Dimensões batem com o pedido (em metros)</li>
          <li>☐ Laminação sem bolhas nem riscos</li>
          <li>☐ Recorte e acabamento dentro da tolerância</li>
          <li>☐ Embalagem adequada para transporte/instalação</li>
          <li>☐ Foto do produto final antes do despacho</li>
        </ul>
      </div>

      {(orcamento.observacoes || enriched?.observacoes_limpas) && (
        <>
          <h2 className="secao-titulo">Observações internas</h2>
          <p
            style={{
              fontSize: "8.4pt",
              color: "#334155",
              whiteSpace: "pre-line",
            }}
          >
            {enriched?.observacoes_limpas || orcamento.observacoes}
          </p>
        </>
      )}
    </>
  );
}

// ── Extras do modo TÉCNICO ──
function FichaTecnicaExtras({
  orcamento,
  itens,
  enriched,
  subtotal,
  total,
  cor,
}: {
  orcamento: Props["orcamento"];
  itens: ItemExtendido[];
  enriched: OrcamentoEnriquecidoPDF | null;
  subtotal: number;
  total: number;
  cor: string;
}) {
  const custoMPTotal = itens.reduce(
    (s, i) => s + Number(i.custo_mp || 0) + totalMateriaisItem(i),
    0,
  );
  const custoMOTotal = itens.reduce((s, i) => s + Number(i.custo_mo || 0), 0);
  const custoFixoTotal = itens.reduce((s, i) => s + Number(i.custo_fixo || 0), 0);
  const custoAcabTotal = itens.reduce((s, i) => s + totalAcabamentosItem(i), 0);
  const custoTotal = custoMPTotal + custoMOTotal + custoFixoTotal + custoAcabTotal;
  const margemBrutaAbs = total - custoTotal;
  const margemBrutaPct = total > 0 ? (margemBrutaAbs / total) * 100 : 0;

  return (
    <>
      <h2 className="secao-titulo">Estrutura de Custos</h2>
      <table>
        <colgroup>
          <col style={{ width: "50%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Componente</th>
            <th style={{ textAlign: "right" }}>Valor</th>
            <th style={{ textAlign: "right" }}>% do total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Matéria-prima (MP)</td>
            <td style={{ textAlign: "right" }}>{brl(custoMPTotal)}</td>
            <td style={{ textAlign: "right", color: "#64748b" }}>
              {total > 0 ? `${formatNumber((custoMPTotal / total) * 100)}%` : "—"}
            </td>
          </tr>
          <tr>
            <td>Mão de obra (MO)</td>
            <td style={{ textAlign: "right" }}>{brl(custoMOTotal)}</td>
            <td style={{ textAlign: "right", color: "#64748b" }}>
              {total > 0 ? `${formatNumber((custoMOTotal / total) * 100)}%` : "—"}
            </td>
          </tr>
          <tr>
            <td>Custo fixo rateado</td>
            <td style={{ textAlign: "right" }}>{brl(custoFixoTotal)}</td>
            <td style={{ textAlign: "right", color: "#64748b" }}>
              {total > 0 ? `${formatNumber((custoFixoTotal / total) * 100)}%` : "—"}
            </td>
          </tr>
          <tr>
            <td>Acabamentos</td>
            <td style={{ textAlign: "right" }}>{brl(custoAcabTotal)}</td>
            <td style={{ textAlign: "right", color: "#64748b" }}>
              {total > 0 ? `${formatNumber((custoAcabTotal / total) * 100)}%` : "—"}
            </td>
          </tr>
          <tr
            style={{
              borderTop: `2px solid ${cor}`,
              fontWeight: 700,
            }}
          >
            <td>Custo total</td>
            <td style={{ textAlign: "right" }}>{brl(custoTotal)}</td>
            <td style={{ textAlign: "right", color: "#64748b" }}>
              {total > 0 ? `${formatNumber((custoTotal / total) * 100)}%` : "—"}
            </td>
          </tr>
          <tr style={{ background: "#f0fdf4", fontWeight: 700, color: "#15803d" }}>
            <td>Margem bruta (antes de comissões/impostos)</td>
            <td style={{ textAlign: "right" }}>{brl(margemBrutaAbs)}</td>
            <td style={{ textAlign: "right" }}>{formatNumber(margemBrutaPct)}%</td>
          </tr>
        </tbody>
      </table>

      <h2 className="secao-titulo">Comissões e Forma de Pagamento</h2>
      <div className="card">
        <dl className="kv">
          <dt>Vendedor</dt>
          <dd>{enriched?.vendedor_nome || "—"}</dd>
          {enriched?.vendedor_comissao_pct != null && (
            <>
              <dt>Comissão vendedor</dt>
              <dd>
                {formatNumber(enriched.vendedor_comissao_pct)}%
                {enriched.vendedor_comissao_valor != null && (
                  <span style={{ color: "#64748b", marginLeft: 8 }}>
                    ≈ {brl(enriched.vendedor_comissao_valor)}
                  </span>
                )}
              </dd>
            </>
          )}
          {enriched?.comissao_externa_pct != null &&
            enriched.comissao_externa_pct > 0 && (
              <>
                <dt>Comissão externa</dt>
                <dd>
                  {enriched.comissao_externa_nome
                    ? `${enriched.comissao_externa_nome} — `
                    : ""}
                  {formatNumber(enriched.comissao_externa_pct)}%
                  {enriched.comissao_externa_valor != null && (
                    <span style={{ color: "#64748b", marginLeft: 8 }}>
                      ≈ {brl(enriched.comissao_externa_valor)}
                    </span>
                  )}
                  {enriched.absorver_comissao && (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "#b45309",
                        fontSize: "7.8pt",
                      }}
                    >
                      · absorvida pela Croma
                    </span>
                  )}
                </dd>
              </>
            )}
          {orcamento.forma_pagamento && (
            <>
              <dt>Forma de pagamento</dt>
              <dd>{labelFormaPagamento(orcamento.forma_pagamento)}</dd>
            </>
          )}
          {orcamento.condicoes_pagamento && (
            <>
              <dt>Condições</dt>
              <dd>{orcamento.condicoes_pagamento}</dd>
            </>
          )}
          {enriched?.tempo_producao_total_min != null &&
            enriched.tempo_producao_total_min > 0 && (
              <>
                <dt>Tempo de produção</dt>
                <dd>{formatMinutos(enriched.tempo_producao_total_min)}</dd>
              </>
            )}
          <dt>Subtotal</dt>
          <dd>{brl(subtotal)}</dd>
          <dt>Total final</dt>
          <dd style={{ fontWeight: 700, color: cor }}>{brl(total)}</dd>
        </dl>
      </div>

      {(orcamento.observacoes || enriched?.observacoes_limpas) && (
        <>
          <h2 className="secao-titulo">Observações internas</h2>
          <p
            style={{
              fontSize: "8.4pt",
              color: "#334155",
              whiteSpace: "pre-line",
            }}
          >
            {enriched?.observacoes_limpas || orcamento.observacoes}
          </p>
        </>
      )}
    </>
  );
}

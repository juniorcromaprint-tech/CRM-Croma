// ============================================================================
// ORCAMENTO PDF MULTI-MODO
// Renderiza a mesma proposta em 3 modos distintos:
//  - cliente   -> visao comercial (header empresa, valores, parcelas, imagem)
//  - producao  -> visao chao de fabrica (materiais, acabamentos, dimensoes,
//                                       imagem, SEM valores unitarios)
//  - tecnico   -> visao interna (modelo/medidas, valor/m2, comissao, forma de
//                               pagamento, SEM materiais)
//
// Baseado na logica do OrcamentoPDF original. A estrutura espelha os PDFs do
// Mubisys que o Junior trouxe como referencia (OS 1069 CALCADOS).
// ============================================================================

import { brl, formatDate, formatCNPJ } from "@/shared/utils/format";
import { CROMA_LOGO_BASE64 } from "@/shared/constants/logo";
import type {
  Orcamento,
  OrcamentoItem,
  OrcamentoItemMaterial,
  OrcamentoItemAcabamento,
  OrcamentoServico,
} from "../services/orcamento.service";

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
    condicoes_pagamento?: string | null;
  };
  modo: ModoPDF;
  nomeEmpresa?: string;
}

const MODO_CONFIG: Record<
  ModoPDF,
  { titulo: string; cor: string; legenda: string }
> = {
  cliente: {
    titulo: "Proposta Comercial",
    cor: "#2563eb",
    legenda: "Visao para o cliente",
  },
  producao: {
    titulo: "Ordem de Producao",
    cor: "#0d9488",
    legenda: "Visao para a producao",
  },
  tecnico: {
    titulo: "Ficha Tecnica Interna",
    cor: "#7c3aed",
    legenda: "Visao interna / comercial",
  },
};

function calcSubtotal(itens: ItemExtendido[]): number {
  return itens.reduce((sum, i) => sum + (i.valor_total || 0), 0);
}

function calcValorM2(item: ItemExtendido): number | null {
  const area = item.area_m2 || 0;
  if (area <= 0) return null;
  return (item.valor_total || 0) / (area * (item.quantidade || 1));
}

function formatDimensoes(item: ItemExtendido): string {
  if (!item.largura_cm && !item.altura_cm) return "—";
  const l = item.largura_cm ? `${item.largura_cm} cm` : "?";
  const h = item.altura_cm ? `${item.altura_cm} cm` : "?";
  return `${l} × ${h}`;
}

export default function OrcamentoPDFMulti({
  orcamento,
  modo,
  nomeEmpresa = "Croma Print Comunicacao Visual",
}: Props) {
  const cfg = MODO_CONFIG[modo];
  const subtotal = calcSubtotal(orcamento.itens);
  const total = orcamento.total || subtotal;

  return (
    <div
      className="orcamento-pdf-multi"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "15mm 12mm",
        background: "white",
        fontFamily: "Arial, sans-serif",
        fontSize: "10pt",
        color: "#1e293b",
      }}
    >
      <style>{`
        .orcamento-pdf-multi h1, .orcamento-pdf-multi h2, .orcamento-pdf-multi h3 { margin: 0; }
        .orcamento-pdf-multi table { border-collapse: collapse; width: 100%; }
        .orcamento-pdf-multi th, .orcamento-pdf-multi td { padding: 6px 8px; text-align: left; font-size: 9pt; vertical-align: top; }
        .orcamento-pdf-multi thead th { background: #f1f5f9; border-bottom: 2px solid ${cfg.cor}; font-weight: 600; color: #334155; }
        .orcamento-pdf-multi tbody tr { border-bottom: 1px solid #e2e8f0; }
        .orcamento-pdf-multi .tag {
          display: inline-block; padding: 2px 8px; border-radius: 999px;
          font-size: 8pt; font-weight: 600; color: white;
        }
        .orcamento-pdf-multi .thumb {
          width: 72px; height: 72px; object-fit: cover; border-radius: 8px;
          border: 1px solid #e2e8f0; background: #f8fafc;
        }
      `}</style>

      {/* HEADER */}
      {modo === "cliente" ? (
        <HeaderCliente cor={cfg.cor} nomeEmpresa={nomeEmpresa} orcamento={orcamento} />
      ) : (
        <HeaderSimples cor={cfg.cor} titulo={cfg.titulo} orcamento={orcamento} />
      )}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="tag" style={{ background: cfg.cor }}>{cfg.legenda}</span>
        <span style={{ fontSize: "9pt", color: "#64748b" }}>
          Emitido em {formatDate(new Date())}
        </span>
      </div>

      {/* DADOS CLIENTE */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: "11pt", color: "#334155", marginBottom: 6 }}>Cliente</h2>
        <table>
          <tbody>
            <tr>
              <td style={{ width: "50%" }}>
                <strong>{orcamento.cliente_nome || "—"}</strong><br />
                {orcamento.cliente_cnpj && (
                  <span style={{ color: "#64748b" }}>CNPJ: {formatCNPJ(orcamento.cliente_cnpj)}</span>
                )}
              </td>
              <td>
                {orcamento.cliente_endereco && (
                  <span>{orcamento.cliente_endereco}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ITENS — rendering varia por modo */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: "11pt", color: "#334155", marginBottom: 6 }}>Itens</h2>
        {modo === "cliente" && <TabelaItensCliente itens={orcamento.itens} />}
        {modo === "producao" && <TabelaItensProducao itens={orcamento.itens} />}
        {modo === "tecnico" && <TabelaItensTecnico itens={orcamento.itens} />}
      </section>

      {/* TOTAL — so cliente e tecnico */}
      {(modo === "cliente" || modo === "tecnico") && (
        <section style={{ marginTop: 16, textAlign: "right" }}>
          <div style={{ display: "inline-block", minWidth: 260 }}>
            <table style={{ fontSize: "10pt" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#64748b", textAlign: "right" }}>Subtotal</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{brl(subtotal)}</td>
                </tr>
                {orcamento.desconto ? (
                  <tr>
                    <td style={{ color: "#64748b", textAlign: "right" }}>Desconto</td>
                    <td style={{ textAlign: "right" }}>- {brl(orcamento.desconto)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td style={{
                    textAlign: "right", fontSize: "11pt", fontWeight: 700,
                    color: cfg.cor, borderTop: `2px solid ${cfg.cor}`,
                  }}>
                    Total
                  </td>
                  <td style={{
                    textAlign: "right", fontSize: "11pt", fontWeight: 700,
                    color: cfg.cor, borderTop: `2px solid ${cfg.cor}`,
                  }}>
                    {brl(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PARCELAS — so cliente */}
      {modo === "cliente" && orcamento.condicoes_pagamento && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: "11pt", color: "#334155", marginBottom: 6 }}>Condicoes de Pagamento</h2>
          <p style={{ fontSize: "9pt", color: "#475569" }}>{orcamento.condicoes_pagamento}</p>
        </section>
      )}

      {/* COMISSAO + FORMA PAGTO — so tecnico */}
      {modo === "tecnico" && (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: "11pt", color: "#334155", marginBottom: 6 }}>Informacoes internas</h2>
          <table>
            <tbody>
              <tr>
                <td style={{ width: "40%", color: "#64748b" }}>Vendedor</td>
                <td>{orcamento.vendedor_nome || "—"}</td>
              </tr>
              {orcamento.vendedor_comissao_pct != null && (
                <tr>
                  <td style={{ color: "#64748b" }}>Comissao</td>
                  <td>{orcamento.vendedor_comissao_pct}%</td>
                </tr>
              )}
              {orcamento.forma_pagamento && (
                <tr>
                  <td style={{ color: "#64748b" }}>Forma de pagamento</td>
                  <td>{orcamento.forma_pagamento}</td>
                </tr>
              )}
              {orcamento.condicoes_pagamento && (
                <tr>
                  <td style={{ color: "#64748b" }}>Condicoes</td>
                  <td>{orcamento.condicoes_pagamento}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{
        marginTop: 30, paddingTop: 10, borderTop: "1px solid #e2e8f0",
        fontSize: "8pt", color: "#94a3b8", textAlign: "center",
      }}>
        {nomeEmpresa} · CNPJ 18.923.994/0001-83 · junior@cromaprint.com.br
        · {cfg.titulo} · {cfg.legenda}
      </footer>
    </div>
  );
}

// --- Headers -------------------------------------------------------------

function HeaderCliente({
  cor, nomeEmpresa, orcamento,
}: { cor: string; nomeEmpresa: string; orcamento: Props["orcamento"] }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${cor}`, paddingBottom: 10 }}>
      <div>
        <img src={CROMA_LOGO_BASE64} alt="Croma Print" style={{ height: 48 }} />
        <div style={{ fontSize: "8pt", color: "#64748b", marginTop: 4 }}>
          {nomeEmpresa} · CNPJ 18.923.994/0001-83<br />
          www.cromaprint.com.br · junior@cromaprint.com.br
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <h1 style={{ fontSize: "18pt", color: cor }}>Proposta {orcamento.numero}</h1>
        <div style={{ fontSize: "9pt", color: "#64748b" }}>
          Emitida em {formatDate(orcamento.created_at)}<br />
          {orcamento.validade_dias ? `Valida por ${orcamento.validade_dias} dias` : ""}
        </div>
      </div>
    </header>
  );
}

function HeaderSimples({
  cor, titulo, orcamento,
}: { cor: string; titulo: string; orcamento: Props["orcamento"] }) {
  return (
    <header style={{ borderBottom: `3px solid ${cor}`, paddingBottom: 8 }}>
      <h1 style={{ fontSize: "16pt", color: cor }}>{titulo} — #{orcamento.numero}</h1>
      <div style={{ fontSize: "9pt", color: "#64748b" }}>
        {orcamento.cliente_nome || ""}
      </div>
    </header>
  );
}

// --- Tabelas por modo ---------------------------------------------------

function ThumbArte({ item }: { item: ItemExtendido }) {
  const url = item.arte_preview_url || item.arte_url;
  if (!url) {
    return (
      <div className="thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: "8pt" }}>
        sem arte
      </div>
    );
  }
  return <img src={url} alt="Arte" className="thumb" crossOrigin="anonymous" />;
}

function TabelaItensCliente({ itens }: { itens: ItemExtendido[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: "90px" }}>Imagem</th>
          <th>Descricao</th>
          <th style={{ width: "90px" }}>Medidas</th>
          <th style={{ width: "60px", textAlign: "center" }}>Qtd</th>
          <th style={{ width: "90px", textAlign: "right" }}>Valor unit.</th>
          <th style={{ width: "90px", textAlign: "right" }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => (
          <tr key={item.id}>
            <td><ThumbArte item={item} /></td>
            <td>
              <strong>{item.descricao}</strong>
              {item.especificacao && (
                <div style={{ color: "#64748b", fontSize: "8pt" }}>{item.especificacao}</div>
              )}
            </td>
            <td>{formatDimensoes(item)}</td>
            <td style={{ textAlign: "center" }}>{item.quantidade}</td>
            <td style={{ textAlign: "right" }}>{brl(item.valor_unitario || 0)}</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{brl(item.valor_total || 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaItensProducao({ itens }: { itens: ItemExtendido[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: "90px" }}>Imagem</th>
          <th>Item & Especificacao tecnica</th>
          <th style={{ width: "100px" }}>Medidas</th>
          <th style={{ width: "60px", textAlign: "center" }}>Qtd</th>
          <th style={{ width: "60px", textAlign: "center" }}>m²</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => (
          <tr key={item.id}>
            <td><ThumbArte item={item} /></td>
            <td>
              <strong>{item.descricao}</strong>
              {item.especificacao && (
                <div style={{ color: "#475569", fontSize: "8pt" }}>{item.especificacao}</div>
              )}
              {item.materiais && item.materiais.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: "8pt", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Materia-prima
                  </div>
                  <ul style={{ margin: "3px 0", paddingLeft: 16, fontSize: "8pt", color: "#475569" }}>
                    {item.materiais.map((m) => (
                      <li key={m.id}>
                        {(m as any).material_nome || (m as any).nome || "Material"}
                        {(m as any).quantidade ? ` — ${(m as any).quantidade} ${(m as any).unidade || ""}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.acabamentos && item.acabamentos.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: "8pt", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Acabamentos
                  </div>
                  <ul style={{ margin: "3px 0", paddingLeft: 16, fontSize: "8pt", color: "#475569" }}>
                    {item.acabamentos.map((a) => (
                      <li key={a.id}>
                        {(a as any).acabamento_nome || (a as any).nome || "Acabamento"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </td>
            <td>{formatDimensoes(item)}</td>
            <td style={{ textAlign: "center" }}>{item.quantidade}</td>
            <td style={{ textAlign: "center" }}>{item.area_m2 ? item.area_m2.toFixed(2) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaItensTecnico({ itens }: { itens: ItemExtendido[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: "80px" }}>Imagem</th>
          <th>Modelo / Item</th>
          <th style={{ width: "90px" }}>Medidas</th>
          <th style={{ width: "50px", textAlign: "center" }}>Qtd</th>
          <th style={{ width: "90px", textAlign: "right" }}>Valor/m²</th>
          <th style={{ width: "90px", textAlign: "right" }}>Valor unit.</th>
          <th style={{ width: "90px", textAlign: "right" }}>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => {
          const valorM2 = calcValorM2(item);
          return (
            <tr key={item.id}>
              <td><ThumbArte item={item} /></td>
              <td>
                <strong>{item.descricao}</strong>
                {item.especificacao && (
                  <div style={{ color: "#64748b", fontSize: "8pt" }}>{item.especificacao}</div>
                )}
              </td>
              <td>{formatDimensoes(item)}</td>
              <td style={{ textAlign: "center" }}>{item.quantidade}</td>
              <td style={{ textAlign: "right" }}>{valorM2 != null ? brl(valorM2) : "—"}</td>
              <td style={{ textAlign: "right" }}>{brl(item.valor_unitario || 0)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{brl(item.valor_total || 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

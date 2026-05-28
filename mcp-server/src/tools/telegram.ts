/**
 * Ferramentas de Telegram — gestão de acesso ao bot Claudete
 *
 * O bot @Claudete_Juca_bot roda como processo Python local (claudete_bot.py)
 * em C:\Users\Caldera\Claude\JARVIS. A autorização é via chat_id, lista em:
 *   - .env (AUTHORIZED_CHAT_IDS=id1,id2,...)
 *   - claudete_bot_config.json (authorized_chat_ids: [id1, id2, ...])
 *
 * Estas tools permitem ao Claude operar essa lista sem precisar reiniciar o bot.
 * O bot detecta mudança via mtime do .env e recarrega a lista em runtime.
 *
 * Também há um arquivo telegram_pedidos_acesso.json gerido pelo próprio bot,
 * onde cada chat_id não autorizado que mandou mensagem fica registrado.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { formatDateTime } from "../utils/formatting.js";

// ─── Caminhos fixos (bot vive em pasta conhecida) ─────────────────────────────

const JARVIS_DIR = "C:\\Users\\Caldera\\Claude\\JARVIS";
const ENV_PATH = path.join(JARVIS_DIR, ".env");
const CONFIG_PATH = path.join(JARVIS_DIR, "claudete_bot_config.json");
const PEDIDOS_PATH = path.join(JARVIS_DIR, "telegram_pedidos_acesso.json");

// ─── Helpers de leitura/escrita ───────────────────────────────────────────────

interface UsuarioInfo {
  chat_id: number;
  nome?: string;
  autorizado_em?: string;
  autorizado_por?: string;
}

interface PedidoAcesso {
  chat_id: number;
  nome?: string;
  username?: string;
  primeira_mensagem?: string;
  timestamp: string;
  notificado?: boolean;
  status: "pendente" | "autorizado" | "bloqueado";
  decidido_em?: string;
}

function lerEnv(): string {
  return fs.readFileSync(ENV_PATH, "utf-8");
}

function escreverEnv(conteudo: string): void {
  fs.writeFileSync(ENV_PATH, conteudo, "utf-8");
}

function lerAutorizadosDoEnv(): number[] {
  const conteudo = lerEnv();
  const match = conteudo.match(/^AUTHORIZED_CHAT_IDS=(.*)$/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map((s) => Number(s));
}

function escreverAutorizadosNoEnv(ids: number[]): void {
  const conteudo = lerEnv();
  const linhaNova = `AUTHORIZED_CHAT_IDS=${ids.join(",")}`;
  let novo: string;
  if (/^AUTHORIZED_CHAT_IDS=/m.test(conteudo)) {
    novo = conteudo.replace(/^AUTHORIZED_CHAT_IDS=.*$/m, linhaNova);
  } else {
    // Adiciona ao final se não existir
    novo = conteudo.trimEnd() + "\n" + linhaNova + "\n";
  }
  escreverEnv(novo);
}

interface ConfigJson {
  authorized_chat_ids?: number[];
  blocked_chat_ids?: number[];
  _info?: {
    bot_username?: string;
    chat_id_junior?: number;
    usuarios?: UsuarioInfo[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function lerConfig(): ConfigJson {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as ConfigJson;
}

function escreverConfig(cfg: ConfigJson): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
}

function lerPedidos(): PedidoAcesso[] {
  if (!fs.existsSync(PEDIDOS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(PEDIDOS_PATH, "utf-8")) as PedidoAcesso[];
  } catch {
    return [];
  }
}

function escreverPedidos(pedidos: PedidoAcesso[]): void {
  fs.writeFileSync(PEDIDOS_PATH, JSON.stringify(pedidos, null, 2) + "\n", "utf-8");
}

function atualizarPedidoStatus(
  chatId: number,
  status: PedidoAcesso["status"]
): void {
  const pedidos = lerPedidos();
  const idx = pedidos.findIndex((p) => p.chat_id === chatId);
  if (idx >= 0) {
    pedidos[idx].status = status;
    pedidos[idx].decidido_em = new Date().toISOString();
    escreverPedidos(pedidos);
  }
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export function registerTelegramTools(server: McpServer): void {
  // ─── croma_telegram_autorizar ───────────────────────────────────────────────

  server.registerTool(
    "croma_telegram_autorizar",
    {
      title: "Autorizar ou remover chat_id do bot Claudete",
      description: `Adiciona ou remove um chat_id da lista de autorizados do bot Telegram @Claudete_Juca_bot.

Atualiza ambos os arquivos de config:
  - C:\\Users\\Caldera\\Claude\\JARVIS\\.env  (AUTHORIZED_CHAT_IDS)
  - C:\\Users\\Caldera\\Claude\\JARVIS\\claudete_bot_config.json

O bot detecta a mudança automaticamente via mtime do .env (não precisa reiniciar).

IMPORTANTE: chat_id NÃO é o número de telefone. É um inteiro que o Telegram atribui
a cada conversa com o bot. Só é possível autorizar DEPOIS que a pessoa mandar a
primeira mensagem ao bot (o chat_id aparece no log como "Mensagem nao autorizada de chat_id=XXX").

Use croma_telegram_pedidos_pendentes para listar quem está esperando aprovação.

Args:
  - chat_id (number, obrigatório): chat_id do Telegram (ex: 7755709957)
  - acao ('autorizar' | 'remover', padrão 'autorizar')
  - nome (string, opcional): nome legível pra registro (ex: "Viviane Penninck")`,
      inputSchema: z.object({
        chat_id: z.coerce.number().int().positive().describe("chat_id numérico do Telegram"),
        acao: z.enum(["autorizar", "remover"]).default("autorizar"),
        nome: z.string().max(120).optional().describe("Nome legível (opcional)"),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        // Verifica que o ambiente Claudete existe (estamos no PC certo)
        if (!fs.existsSync(ENV_PATH)) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Não encontrei o .env do bot em ${ENV_PATH}.\n` +
                    `Isso só funciona quando o MCP roda no mesmo PC que o bot Claudete.`,
            }],
          };
        }

        const idsAtuais = lerAutorizadosDoEnv();
        const cfg = lerConfig();
        const usuarios = (cfg._info?.usuarios ?? []) as UsuarioInfo[];

        let novosIds: number[];
        let descricao: string;

        if (params.acao === "autorizar") {
          if (idsAtuais.includes(params.chat_id)) {
            return {
              content: [{
                type: "text" as const,
                text: `ℹ️ chat_id ${params.chat_id} já está autorizado. Nada a fazer.`,
              }],
              structuredContent: {
                ok: true,
                ja_autorizado: true,
                chat_id: params.chat_id,
                autorizados: idsAtuais,
              },
            };
          }
          novosIds = [...idsAtuais, params.chat_id];
          descricao = `✅ chat_id ${params.chat_id} autorizado`;

          // Atualiza metadata
          const idxUser = usuarios.findIndex((u) => u.chat_id === params.chat_id);
          const userInfo: UsuarioInfo = {
            chat_id: params.chat_id,
            nome: params.nome,
            autorizado_em: new Date().toISOString(),
            autorizado_por: "mcp:croma_telegram_autorizar",
          };
          if (idxUser >= 0) usuarios[idxUser] = { ...usuarios[idxUser], ...userInfo };
          else usuarios.push(userInfo);
        } else {
          // remover
          if (!idsAtuais.includes(params.chat_id)) {
            return {
              content: [{
                type: "text" as const,
                text: `ℹ️ chat_id ${params.chat_id} não estava na lista de autorizados.`,
              }],
              structuredContent: {
                ok: true,
                nao_estava: true,
                chat_id: params.chat_id,
                autorizados: idsAtuais,
              },
            };
          }
          // Proteção: não remove o Junior (chat_id_junior da config)
          const chatIdJunior = cfg._info?.chat_id_junior;
          if (chatIdJunior && params.chat_id === chatIdJunior) {
            return {
              content: [{
                type: "text" as const,
                text: `🛑 Bloqueado: chat_id ${params.chat_id} é o do Junior (administrador). ` +
                      `Remover travaria você fora do próprio bot. Operação cancelada.`,
              }],
            };
          }
          novosIds = idsAtuais.filter((id) => id !== params.chat_id);
          descricao = `🗑️ chat_id ${params.chat_id} removido da lista de autorizados`;
        }

        // Escreve .env
        escreverAutorizadosNoEnv(novosIds);

        // Atualiza JSON de fallback
        cfg.authorized_chat_ids = novosIds;
        if (!cfg._info) cfg._info = {};
        cfg._info.usuarios = usuarios;
        escreverConfig(cfg);

        // Atualiza pedido pendente (se existir)
        if (params.acao === "autorizar") {
          atualizarPedidoStatus(params.chat_id, "autorizado");
        }

        const detalhes = {
          ok: true,
          acao: params.acao,
          chat_id: params.chat_id,
          nome: params.nome,
          autorizados_antes: idsAtuais,
          autorizados_agora: novosIds,
          env_path: ENV_PATH,
          config_path: CONFIG_PATH,
        };

        if (params.response_format === ResponseFormat.MARKDOWN) {
          const linhas = [
            `# ${descricao}`,
            "",
            `**Ação**: ${params.acao}`,
            `**chat_id**: ${params.chat_id}${params.nome ? ` (${params.nome})` : ""}`,
            "",
            `## Lista atual de autorizados`,
            ...novosIds.map((id) => {
              const u = usuarios.find((x) => x.chat_id === id);
              const label = u?.nome ? ` — ${u.nome}` : "";
              return `- \`${id}\`${label}`;
            }),
            "",
            `_O bot recarrega a lista automaticamente em até 5 segundos._`,
          ];
          return {
            content: [{ type: "text" as const, text: linhas.join("\n") }],
            structuredContent: detalhes,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(detalhes, null, 2) }],
          structuredContent: detalhes,
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_telegram_listar_autorizados ──────────────────────────────────────

  server.registerTool(
    "croma_telegram_listar_autorizados",
    {
      title: "Listar chat_ids autorizados a falar com a Claudete",
      description: `Lista todos os chat_ids autorizados a usar o bot @Claudete_Juca_bot,
com nomes legíveis quando disponíveis.

Lê de .env (fonte da verdade) e enriquece com metadata de claudete_bot_config.json.

Args:
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        if (!fs.existsSync(ENV_PATH)) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Não encontrei o .env do bot em ${ENV_PATH}.`,
            }],
          };
        }
        const ids = lerAutorizadosDoEnv();
        const cfg = lerConfig();
        const usuarios = (cfg._info?.usuarios ?? []) as UsuarioInfo[];

        const detalhes = ids.map((id) => {
          const u = usuarios.find((x) => x.chat_id === id);
          return {
            chat_id: id,
            nome: u?.nome,
            autorizado_em: u?.autorizado_em,
            autorizado_por: u?.autorizado_por,
          };
        });

        if (params.response_format === ResponseFormat.MARKDOWN) {
          const linhas = [
            `# Autorizados a falar com a Claudete`,
            `**Total**: ${ids.length}`,
            "",
            ...detalhes.map((d) => {
              const nome = d.nome ?? "_sem nome registrado_";
              const quando = d.autorizado_em ? ` _(desde ${formatDateTime(d.autorizado_em)})_` : "";
              return `- \`${d.chat_id}\` — ${nome}${quando}`;
            }),
          ];
          return {
            content: [{ type: "text" as const, text: linhas.join("\n") }],
            structuredContent: { total: ids.length, autorizados: detalhes },
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: ids.length, autorizados: detalhes }, null, 2),
          }],
          structuredContent: { total: ids.length, autorizados: detalhes },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── croma_telegram_pedidos_pendentes ───────────────────────────────────────

  server.registerTool(
    "croma_telegram_pedidos_pendentes",
    {
      title: "Listar pedidos de acesso pendentes ao bot Claudete",
      description: `Lista chat_ids que tentaram falar com a Claudete mas não estão autorizados.

O bot registra cada tentativa em telegram_pedidos_acesso.json (status: 'pendente').
Quando o Junior autoriza ou bloqueia via botão inline, o status muda para
'autorizado' ou 'bloqueado'.

Útil pra ver quem está esperando aprovação.

Args:
  - incluir_decididos (boolean, padrão false): se true, inclui também os já autorizados/bloqueados
  - response_format ('markdown'|'json'): Padrão markdown`,
      inputSchema: z.object({
        incluir_decididos: z.coerce.boolean().default(false),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const pedidos = lerPedidos();
        const filtrados = params.incluir_decididos
          ? pedidos
          : pedidos.filter((p) => p.status === "pendente");

        if (filtrados.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: params.incluir_decididos
                ? "Nenhum pedido de acesso registrado."
                : "✅ Nenhum pedido pendente. Caixa limpa.",
            }],
            structuredContent: { total: 0, pedidos: [] },
          };
        }

        if (params.response_format === ResponseFormat.MARKDOWN) {
          const linhas = [
            `# Pedidos de acesso ao bot Claudete`,
            `**Total**: ${filtrados.length}${params.incluir_decididos ? "" : " (apenas pendentes)"}`,
            "",
            ...filtrados.map((p) => {
              const emoji = p.status === "pendente" ? "⏳"
                : p.status === "autorizado" ? "✅" : "⛔";
              const quem = p.nome ? p.nome : "_sem nome_";
              const user = p.username ? ` (@${p.username})` : "";
              const msg = p.primeira_mensagem ? `\n  > "${p.primeira_mensagem.slice(0, 120)}"` : "";
              return `- ${emoji} **${quem}**${user} — chat_id \`${p.chat_id}\`\n  _${formatDateTime(p.timestamp)}_${msg}`;
            }),
            "",
            params.incluir_decididos
              ? ""
              : `_Use croma_telegram_autorizar com o chat_id desejado para autorizar._`,
          ];
          return {
            content: [{ type: "text" as const, text: linhas.join("\n") }],
            structuredContent: { total: filtrados.length, pedidos: filtrados },
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ total: filtrados.length, pedidos: filtrados }, null, 2),
          }],
          structuredContent: { total: filtrados.length, pedidos: filtrados },
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

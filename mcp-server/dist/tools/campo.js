/**
 * Ferramentas de InstalaÃ§Ã£o / App de Campo
 * Consultar ordens de instalaÃ§Ã£o e agendar novas
 */
import { z } from "zod";
import { getAdminClient, getUserClient } from "../supabase-client.js";
import { ResponseFormat } from "../types.js";
import { errorResult } from "../utils/errors.js";
import { buildPaginatedResponse, truncateIfNeeded } from "../utils/pagination.js";
import { formatDate, formatDateTime, formatStatus } from "../utils/formatting.js";
/**
 * Geocodifica um endereÃ§o usando a API do Nominatim (OSM).
 * Retorna null se nÃ£o encontrar ou ocorrer erro de rede.
 * Usa User-Agent obrigatÃ³rio para respeitar ToS do Nominatim.
 */
async function geocodificarEndereco(endereco) {
    try {
        const q = encodeURIComponent(endereco + ", Brasil");
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`;
        const res = await fetch(url, {
            headers: {
                "User-Agent": "CromaPrint-MCP/1.0 (junior@cromaprint.com.br)",
                "Accept-Language": "pt-BR,pt;q=0.9",
            },
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        if (!data || data.length === 0)
            return null;
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display_name: data[0].display_name,
        };
    }
    catch {
        return null;
    }
}
export function registerCampoTools(server) {
    // â•â•â• croma_listar_instalacoes â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_listar_instalacoes", {
        title: "Listar InstalaÃ§Ãµes",
        description: `Lista ordens de instalaÃ§Ã£o com filtros.

Use para "instalaÃ§Ãµes de amanhÃ£", "instalaÃ§Ãµes pendentes", "expediÃ§Ã£o da semana", "instalaÃ§Ãµes do tÃ©cnico X".

Args:
  - status (string, opcional): pendente|agendada|em_execucao|concluida|reagendada|cancelada
  - equipe_id (string, opcional): UUID da equipe
  - data_inicio (string, opcional): Data de agendamento inicial (ISO)
  - data_fim (string, opcional): Data de agendamento final (ISO)
  - cidade (string, opcional): Filtrar por cidade
  - limit (number): PadrÃ£o 20
  - offset (number): PaginaÃ§Ã£o
  - response_format ('markdown'|'json'): PadrÃ£o markdown`,
        inputSchema: z.object({
            status: z.enum(["pendente", "agendada", "em_execucao", "concluida", "reagendada", "cancelada"]).optional(),
            equipe_id: z.string().uuid().optional(),
            data_inicio: z.string().optional().describe("ISO date, filtro em data_agendada"),
            data_fim: z.string().optional(),
            cidade: z.string().optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            let query = sb
                .from("ordens_instalacao")
                .select(`id, numero, status, data_agendada, hora_prevista, endereco_completo,
             instrucoes, observacoes, lat, lng, created_at,
             pedidos(numero, clientes(razao_social, nome_fantasia)),
             equipes(nome)`, { count: "exact" });
            if (params.status)
                query = query.eq("status", params.status);
            if (params.equipe_id)
                query = query.eq("equipe_id", params.equipe_id);
            if (params.cidade)
                query = query.ilike("endereco_completo", `%${params.cidade}%`);
            if (params.data_inicio)
                query = query.gte("data_agendada", params.data_inicio);
            if (params.data_fim)
                query = query.lte("data_agendada", params.data_fim + "T23:59:59");
            query = query
                .order("data_agendada", { ascending: true, nullsFirst: false })
                .range(params.offset, params.offset + params.limit - 1);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const total = count ?? items.length;
            const response = buildPaginatedResponse(items, total, params.offset, params.limit);
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## InstalaÃ§Ãµes (${total} encontradas)`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhuma instalaÃ§Ã£o encontrada._");
                }
                else {
                    for (const inst of items) {
                        const pedido = inst.pedidos ?? {};
                        const cliente = pedido.clientes ?? {};
                        const equipe = inst.equipes ?? {};
                        const nomeCliente = cliente.nome_fantasia ?? cliente.razao_social ?? "â€”";
                        lines.push(`### ${inst.numero} â€” ${nomeCliente}`);
                        lines.push(`- **Pedido**: ${pedido.numero ?? "â€”"}`);
                        lines.push(`- **Status**: ${formatStatus(inst.status)}`);
                        if (inst.data_agendada)
                            lines.push(`- **Data agendada**: ${formatDate(inst.data_agendada)}`);
                        if (inst.endereco_completo)
                            lines.push(`- **EndereÃ§o**: ${inst.endereco_completo}`);
                        if (inst.hora_prevista)
                            lines.push(`- **Hora**: ${inst.hora_prevista}`);
                        if (equipe.nome)
                            lines.push(`- **Equipe**: ${equipe.nome}`);
                        if (inst.instrucoes)
                            lines.push(`- **InstruÃ§Ãµes**: ${inst.instrucoes}`);
                        if (inst.observacoes)
                            lines.push(`- **Obs**: ${inst.observacoes}`);
                        if (inst.lat && inst.lng)
                            lines.push(`- **GPS**: ${inst.lat}, ${inst.lng}`);
                        lines.push("");
                    }
                    if (response.has_more)
                        lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify(response, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: response,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_listar_jobs_campo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_listar_jobs_campo", {
        title: "Listar Jobs do App Campo",
        description: `Lista jobs do App Campo (instalaÃ§Ãµes e merchandising) com filtros.

Use para "jobs de hoje", "jobs pendentes", "jobs do tÃ©cnico X", "merchandising da Beira Rio".

Tipo de job:
- instalacao: tem vÃ­nculo com ordem_instalacao_id ou pedido_id no CRM
- merchandising: sem vÃ­nculo (maioria dos casos atuais â€” serviÃ§os avulsos como Beira Rio)

Args:
  - status (string, opcional): Pendente|Em Andamento|ConcluÃ­do|Cancelado
  - tecnico_id (string UUID, opcional): filtrar por tÃ©cnico
  - loja_nome (string, opcional): busca parcial no nome da loja
  - data_inicio (string ISO, opcional): filtro em data_agendada
  - data_fim (string ISO, opcional): filtro em data_agendada
  - tipo (string, opcional): instalacao|merchandising
  - limit (number): padrÃ£o 20
  - offset (number): paginaÃ§Ã£o
  - response_format ('markdown'|'json'): padrÃ£o markdown`,
        inputSchema: z.object({
            status: z.enum(["Pendente", "Em Andamento", "ConcluÃ­do", "Cancelado"]).optional(),
            tecnico_id: z.string().uuid().optional(),
            loja_nome: z.string().optional(),
            data_inicio: z.string().optional().describe("ISO date filtro em data_agendada"),
            data_fim: z.string().optional(),
            tipo: z.enum(["instalacao", "merchandising"]).optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().min(0).default(0),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            let query = sb
                .from("vw_campo_instalacoes")
                .select(`job_id, os_number, tipo_servico, status_campo, data_agendada,
             loja_nome, loja_marca, loja_endereco, loja_estado,
             tecnico_nome, fotos_antes, fotos_depois, duracao_minutos,
             ordem_instalacao_id, pedido_id, created_at`, { count: "exact" });
            if (params.status)
                query = query.eq("status_campo", params.status);
            if (params.tecnico_id)
                query = query.eq("tecnico_id", params.tecnico_id);
            if (params.loja_nome)
                query = query.ilike("loja_nome", `%${params.loja_nome}%`);
            if (params.data_inicio)
                query = query.gte("data_agendada", params.data_inicio);
            if (params.data_fim)
                query = query.lte("data_agendada", params.data_fim);
            if (params.tipo === "instalacao") {
                query = query.or("ordem_instalacao_id.not.is.null,pedido_id.not.is.null");
            }
            else if (params.tipo === "merchandising") {
                query = query.is("ordem_instalacao_id", null).is("pedido_id", null);
            }
            query = query
                .order("data_agendada", { ascending: false, nullsFirst: false })
                .range(params.offset, params.offset + params.limit - 1);
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const total = count ?? items.length;
            const response = buildPaginatedResponse(items, total, params.offset, params.limit);
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## Jobs do Campo (${total} encontrados)`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhum job encontrado._");
                }
                else {
                    for (const job of items) {
                        const tipoLabel = (job.ordem_instalacao_id || job.pedido_id) ? "InstalaÃ§Ã£o" : "Merchandising";
                        lines.push(`### OS ${job.os_number} â€” ${job.loja_nome ?? "â€”"}`);
                        lines.push(`- **Tipo**: ${tipoLabel} (${job.tipo_servico})`);
                        lines.push(`- **Status**: ${job.status_campo}`);
                        if (job.data_agendada)
                            lines.push(`- **Data**: ${formatDate(job.data_agendada)}`);
                        if (job.loja_estado)
                            lines.push(`- **Estado**: ${job.loja_estado}`);
                        if (job.loja_endereco)
                            lines.push(`- **EndereÃ§o**: ${job.loja_endereco}`);
                        if (job.tecnico_nome?.trim())
                            lines.push(`- **TÃ©cnico**: ${job.tecnico_nome}`);
                        lines.push(`- **Fotos**: ${job.fotos_antes ?? 0} antes / ${job.fotos_depois ?? 0} depois`);
                        if (job.duracao_minutos != null)
                            lines.push(`- **DuraÃ§Ã£o**: ${Math.round(Number(job.duracao_minutos))} min`);
                        lines.push(`- **job_id**: \`${job.job_id}\``);
                        lines.push("");
                    }
                    if (response.has_more)
                        lines.push(`_Mais resultados. Use offset: ${response.next_offset}._`);
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify(response, null, 2);
            }
            return {
                content: [{ type: "text", text: truncateIfNeeded(text, items.length) }],
                structuredContent: response,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_detalhe_job_campo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_detalhe_job_campo", {
        title: "Detalhe do Job do Campo",
        description: `Retorna detalhe completo de um job do App Campo, incluindo fotos e assinatura.

Args:
  - job_id (string UUID, obrigatÃ³rio): ID do job
  - response_format ('markdown'|'json'): padrÃ£o markdown`,
        inputSchema: z.object({
            job_id: z.string().uuid(),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            const { data: job, error: jobError } = await sb
                .from("vw_campo_instalacoes")
                .select("*")
                .eq("job_id", params.job_id)
                .single();
            if (jobError)
                return errorResult(jobError);
            if (!job)
                return { content: [{ type: "text", text: `Job nÃ£o encontrado: ${params.job_id}` }] };
            const { data: fotos, error: fotosError } = await sb
                .from("job_photos")
                .select("id, photo_type, photo_url, description, note, created_at")
                .eq("job_id", params.job_id)
                .order("created_at", { ascending: true });
            if (fotosError)
                return errorResult(fotosError);
            const tipoLabel = (job.ordem_instalacao_id || job.pedido_id) ? "InstalaÃ§Ã£o" : "Merchandising";
            const resultado = { ...job, fotos: fotos ?? [] };
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [
                    `## Job ${job.os_number} â€” ${job.loja_nome ?? "â€”"}`,
                    "",
                    `- **Tipo**: ${tipoLabel} (${job.tipo_servico})`,
                    `- **Status**: ${job.status_campo}`,
                    `- **Loja**: ${job.loja_nome ?? "â€”"} ${job.loja_marca ? `(${job.loja_marca})` : ""}`,
                    `- **EndereÃ§o**: ${job.loja_endereco ?? "â€”"}`,
                    `- **Estado**: ${job.loja_estado ?? "â€”"}`,
                ];
                if (job.data_agendada)
                    lines.push(`- **Data agendada**: ${formatDate(job.data_agendada)}`);
                if (job.tecnico_nome?.trim())
                    lines.push(`- **TÃ©cnico**: ${job.tecnico_nome}`);
                if (job.started_at)
                    lines.push(`- **InÃ­cio**: ${formatDateTime(job.started_at)}`);
                if (job.finished_at)
                    lines.push(`- **ConclusÃ£o**: ${formatDateTime(job.finished_at)}`);
                if (job.duracao_minutos != null)
                    lines.push(`- **DuraÃ§Ã£o**: ${Math.round(Number(job.duracao_minutos))} min`);
                if (job.notes)
                    lines.push(`- **Notas**: ${job.notes}`);
                if (job.issues)
                    lines.push(`- **Problemas**: ${job.issues}`);
                if (job.lat && job.lng)
                    lines.push(`- **GPS**: ${job.lat}, ${job.lng}`);
                if (job.signature_url)
                    lines.push(`- **Assinatura**: ${job.signature_url}`);
                if (job.ordem_instalacao_id)
                    lines.push(`- **Ordem instalaÃ§Ã£o**: ${job.ordem_instalacao_id}`);
                if (job.pedido_id)
                    lines.push(`- **Pedido ERP**: ${job.pedido_id}`);
                lines.push(`- **job_id**: \`${job.job_id}\``);
                lines.push("");
                const fotosList = fotos ?? [];
                lines.push(`### Fotos (${fotosList.length} total)`);
                if (fotosList.length === 0) {
                    lines.push("_Nenhuma foto registrada._");
                }
                else {
                    const antes = fotosList.filter((f) => f.photo_type === "before");
                    const depois = fotosList.filter((f) => f.photo_type === "after");
                    lines.push(`- **Antes**: ${antes.length} foto(s)`);
                    lines.push(`- **Depois**: ${depois.length} foto(s)`);
                    for (const foto of fotosList) {
                        lines.push(`  - [${foto.photo_type}] ${foto.photo_url}${foto.description ? ` â€” ${foto.description}` : ""}`);
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify(resultado, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: resultado,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_listar_fotos_job â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_listar_fotos_job", {
        title: "Listar Fotos de um Job",
        description: `Lista fotos (antes/depois) de um job especÃ­fico do App Campo.

Args:
  - job_id (string UUID, obrigatÃ³rio): ID do job
  - tipo (string, opcional): before|after â€” filtra por tipo de foto
  - response_format ('markdown'|'json'): padrÃ£o markdown`,
        inputSchema: z.object({
            job_id: z.string().uuid(),
            tipo: z.enum(["before", "after"]).optional(),
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            let query = sb
                .from("job_photos")
                .select("id, photo_type, photo_url, description, note, created_at", { count: "exact" })
                .eq("job_id", params.job_id);
            if (params.tipo)
                query = query.eq("photo_type", params.tipo);
            query = query.order("created_at", { ascending: true });
            const { data, error, count } = await query;
            if (error)
                return errorResult(error);
            const fotos = data ?? [];
            const total = count ?? fotos.length;
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const tipoLabel = params.tipo ? ` (${params.tipo})` : "";
                const lines = [`## Fotos do Job â€” ${params.job_id}${tipoLabel} (${total} total)`, ""];
                if (fotos.length === 0) {
                    lines.push("_Nenhuma foto encontrada._");
                }
                else {
                    for (const foto of fotos) {
                        const tipoIcon = foto.photo_type === "before" ? "ðŸ“· Antes" : "ðŸ“¸ Depois";
                        lines.push(`- **${tipoIcon}** â€” ${foto.photo_url}`);
                        if (foto.description)
                            lines.push(`  ${foto.description}`);
                        if (foto.note)
                            lines.push(`  _Nota: ${foto.note}_`);
                        lines.push(`  _${formatDateTime(foto.created_at)}_`);
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ job_id: params.job_id, total, fotos }, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: { job_id: params.job_id, total, fotos },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_criar_job_campo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_criar_job_campo", {
        title: "Criar Job no App Campo",
        description: `Cria um novo job no App Campo (instalaÃ§Ã£o ou merchandising).

ATENÃ‡ÃƒO: AÃ§Ã£o que modifica dados. Confirme com Junior antes de executar.

Para merchandising (caso mais comum): informar os_number gerado sequencialmente, tipo_servico = "Merchandising", store_id da loja, sem ordem_instalacao_id e pedido_id.
Para instalaÃ§Ã£o vinculada ao ERP: informar ordem_instalacao_id e/ou pedido_id.

Args:
  - os_number (string, obrigatÃ³rio): nÃºmero da OS
  - tipo_servico (string, obrigatÃ³rio): ex: "Merchandising", "InstalaÃ§Ã£o de Adesivo", "Adesivagem Vitrine", "Placas/Adesivos"
  - store_id (string UUID, obrigatÃ³rio): ID da loja (tabela stores)
  - data_agendada (string ISO, obrigatÃ³rio): data agendada ex: 2026-04-01
  - assigned_to (string UUID, opcional): tÃ©cnico responsÃ¡vel (UUID do usuÃ¡rio)
  - ordem_instalacao_id (string UUID, opcional): vÃ­nculo com ordem de instalaÃ§Ã£o do ERP
  - pedido_id (string UUID, opcional): vÃ­nculo com pedido do ERP
  - notes (string, opcional): instruÃ§Ãµes e observaÃ§Ãµes`,
        inputSchema: z.object({
            os_number: z.string().min(1).max(100),
            tipo_servico: z.string().min(1).max(200),
            store_id: z.string().uuid(),
            data_agendada: z.string().describe("ISO date ex: 2026-04-01"),
            assigned_to: z.string().uuid().optional(),
            ordem_instalacao_id: z.string().uuid().optional(),
            pedido_id: z.string().uuid().optional(),
            notes: z.string().max(2000).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const { data, error } = await sb
                .from("jobs")
                .insert({
                os_number: params.os_number,
                type: params.tipo_servico,
                store_id: params.store_id,
                scheduled_date: params.data_agendada,
                assigned_to: params.assigned_to ?? null,
                ordem_instalacao_id: params.ordem_instalacao_id ?? null,
                pedido_id: params.pedido_id ?? null,
                notes: params.notes ?? null,
                status: "Pendente",
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            const tipoLabel = (params.ordem_instalacao_id || params.pedido_id) ? "InstalaÃ§Ã£o vinculada ao ERP" : "Merchandising";
            return {
                content: [{
                        type: "text",
                        text: [
                            `âœ… Job criado com sucesso!`,
                            ``,
                            `- **OS**: ${data.os_number}`,
                            `- **Tipo**: ${tipoLabel} (${data.type})`,
                            `- **Status**: ${data.status}`,
                            `- **Data agendada**: ${formatDate(data.scheduled_date)}`,
                            `- **job_id**: \`${data.id}\``,
                        ].join("\n"),
                    }],
                structuredContent: data,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_atualizar_job_campo â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_atualizar_job_campo", {
        title: "Atualizar Job do Campo",
        description: `Atualiza status, notas ou dados de execuÃ§Ã£o de um job do App Campo.

ATENÃ‡ÃƒO: AÃ§Ã£o que modifica dados. Confirme com Junior antes de executar.

Se status = "ConcluÃ­do" e finished_at nÃ£o informado, a hora de conclusÃ£o Ã© setada automaticamente.

Args:
  - job_id (string UUID, obrigatÃ³rio): ID do job
  - status (string, opcional): Pendente|Em Andamento|ConcluÃ­do|Cancelado
  - notes (string, opcional): notas adicionais
  - issues (string, opcional): problemas encontrados
  - started_at (string ISO, opcional): hora de inÃ­cio (ex: 2026-04-01T09:00:00)
  - finished_at (string ISO, opcional): hora de conclusÃ£o`,
        inputSchema: z.object({
            job_id: z.string().uuid(),
            status: z.enum(["Pendente", "Em Andamento", "ConcluÃ­do", "Cancelado"]).optional(),
            notes: z.string().max(2000).optional(),
            issues: z.string().max(2000).optional(),
            started_at: z.string().optional().describe("ISO datetime ex: 2026-04-01T09:00:00"),
            finished_at: z.string().optional().describe("ISO datetime ex: 2026-04-01T14:30:00"),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const updates = {};
            if (params.status !== undefined)
                updates.status = params.status;
            if (params.notes !== undefined)
                updates.notes = params.notes;
            if (params.issues !== undefined)
                updates.issues = params.issues;
            if (params.started_at !== undefined)
                updates.started_at = params.started_at;
            if (params.finished_at !== undefined) {
                updates.finished_at = params.finished_at;
            }
            else if (params.status === "ConcluÃ­do") {
                updates.finished_at = new Date().toISOString();
            }
            if (Object.keys(updates).length === 0) {
                return { content: [{ type: "text", text: "Nenhum campo para atualizar informado." }] };
            }
            const { data, error } = await sb
                .from("jobs")
                .update(updates)
                .eq("id", params.job_id)
                .select()
                .single();
            if (error)
                return errorResult(error);
            return {
                content: [{
                        type: "text",
                        text: [
                            `âœ… Job atualizado com sucesso!`,
                            ``,
                            `- **OS**: ${data.os_number}`,
                            `- **Status**: ${data.status}`,
                            ...(data.started_at ? [`- **InÃ­cio**: ${formatDateTime(data.started_at)}`] : []),
                            ...(data.finished_at ? [`- **ConclusÃ£o**: ${formatDateTime(data.finished_at)}`] : []),
                            ...(data.issues ? [`- **Problemas**: ${data.issues}`] : []),
                            `- **job_id**: \`${data.id}\``,
                        ].join("\n"),
                    }],
                structuredContent: data,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_agendar_instalacao â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //     â˜… GeocodificaÃ§Ã£o automÃ¡tica via Nominatim (OSM) â˜…
    server.registerTool("croma_agendar_instalacao", {
        title: "Agendar InstalaÃ§Ã£o",
        description: `Cria ou agenda uma ordem de instalaÃ§Ã£o para um pedido.
Geocodifica automaticamente o endereÃ§o via Nominatim (OSM) e salva lat/lng
na ordem e no job do App Campo.

ATENÃ‡ÃƒO: AÃ§Ã£o que modifica dados. Confirme antes de executar.

Args:
  - pedido_id (string, obrigatÃ³rio): UUID do pedido que serÃ¡ instalado
  - data_agendada (string, obrigatÃ³rio): Data da instalaÃ§Ã£o ISO (ex: 2026-04-01)
  - hora_prevista (string, opcional): Hora prevista (ex: 09:00)
  - endereco_completo (string, obrigatÃ³rio): EndereÃ§o completo do local (incluir cidade/estado)
  - equipe_id (string, opcional): UUID da equipe responsÃ¡vel
  - instrucoes (string, opcional): InstruÃ§Ãµes para a equipe
  - materiais_necessarios (string, opcional): Lista de materiais necessÃ¡rios
  - observacoes (string, opcional): ObservaÃ§Ãµes gerais`,
        inputSchema: z.object({
            pedido_id: z.string().uuid(),
            data_agendada: z.string().describe("ISO date ex: 2026-04-01"),
            hora_prevista: z.string().optional().describe("Hora prevista ex: 09:00"),
            endereco_completo: z.string().min(5).max(400),
            equipe_id: z.string().uuid().optional(),
            instrucoes: z.string().max(1000).optional(),
            materiais_necessarios: z.string().max(1000).optional(),
            observacoes: z.string().max(1000).optional(),
        }).strict(),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getUserClient();
            const sbAdmin = getAdminClient();
            // 1) Verifica se pedido existe e pega cliente_id
            const { data: pedido, error: pedidoError } = await sb
                .from("pedidos")
                .select("id, numero, status, cliente_id")
                .eq("id", params.pedido_id)
                .single();
            if (pedidoError)
                return errorResult(pedidoError);
            if (!pedido)
                return { content: [{ type: "text", text: `Pedido nÃ£o encontrado: ${params.pedido_id}` }] };
            // 2) Geocodificar endereÃ§o (nÃ£o bloqueia em caso de falha)
            const geo = await geocodificarEndereco(params.endereco_completo);
            const geoLog = geo
                ? `ðŸ“ Geocodificado: ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`
                : `âš ï¸ GeocodificaÃ§Ã£o nÃ£o encontrou resultado para o endereÃ§o informado`;
            // 3) Cria a ordem de instalaÃ§Ã£o (com lat/lng se geocodificado)
            const { data, error } = await sb
                .from("ordens_instalacao")
                .insert({
                pedido_id: params.pedido_id,
                cliente_id: pedido.cliente_id,
                status: "agendada",
                data_agendada: params.data_agendada,
                hora_prevista: params.hora_prevista,
                endereco_completo: params.endereco_completo,
                instrucoes: params.instrucoes,
                materiais_necessarios: params.materiais_necessarios,
                equipe_id: params.equipe_id,
                observacoes: params.observacoes,
                lat: geo?.lat ?? null,
                lng: geo?.lng ?? null,
                geocodificado_em: geo ? new Date().toISOString() : null,
                geocodificado_por: geo ? "nominatim" : null,
            })
                .select()
                .single();
            if (error)
                return errorResult(error);
            // 4) Busca o job criado automaticamente pelo trigger fn_create_job_from_ordem
            //    (aguarda atÃ© 1s para o trigger executar)
            await new Promise((resolve) => setTimeout(resolve, 800));
            const { data: job } = await sbAdmin
                .from("jobs")
                .select("id, os_number, status, lat, lng, stores(name, address)")
                .eq("ordem_instalacao_id", data.id)
                .is("deleted_at", null)
                .maybeSingle();
            // 5) Se geocodificou e job foi criado, atualiza lat/lng no job tambÃ©m
            if (geo && job) {
                await sbAdmin
                    .from("jobs")
                    .update({ lat: geo.lat, lng: geo.lng })
                    .eq("id", job.id);
            }
            // 6) Copiar attachments do pedido para o job recem-criado (se houver)
            let attachmentsCopied = 0;
            if (params.pedido_id && job?.id) {
                const { data: pedidoAtts } = await sbAdmin
                    .from("job_attachments")
                    .select("*")
                    .eq("pedido_id", params.pedido_id)
                    .is("deleted_at", null);
                if (pedidoAtts && pedidoAtts.length > 0) {
                    const copies = pedidoAtts.map((att) => ({
                        job_id: job.id,
                        tipo: att.tipo,
                        file_url: att.file_url,
                        file_name: att.file_name,
                        file_size: att.file_size,
                        mime_type: att.mime_type,
                        description: att.description,
                        uploaded_by: att.uploaded_by,
                        uploaded_by_name: att.uploaded_by_name,
                        source: "trigger",
                        ordem_instalacao_id: data.id,
                        pedido_id: params.pedido_id,
                    }));
                    await sbAdmin.from("job_attachments").insert(copies);
                    attachmentsCopied = copies.length;
                }
            }
            const jobInfo = job
                ? [
                    ``,
                    `**Job criado no App Campo automaticamente:**`,
                    `- **OS**: ${job.os_number}`,
                    `- **Status Campo**: ${job.status}`,
                    ...(job.stores ? [`- **Loja**: ${job.stores.name} â€” ${job.stores.address}`] : [`- âš ï¸ Store nÃ£o vinculada â€” verifique o endereÃ§o da OS`]),
                    ...(geo ? [`- **GPS Job**: ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)} âœ“`] : []),
                    `- **job_id**: \`${job.id}\``,
                ]
                : [
                    ``,
                    `âš ï¸ Job no App Campo nÃ£o criado automaticamente. Use \`croma_criar_job_campo\` para criar manualmente.`,
                ];
            return {
                content: [{
                        type: "text",
                        text: [
                            `âœ… InstalaÃ§Ã£o agendada com sucesso!`,
                            ``,
                            `- **NÃºmero**: ${data.numero}`,
                            `- **Pedido**: ${pedido.numero}`,
                            `- **Data**: ${formatDate(data.data_agendada)}`,
                            `- **Local**: ${data.endereco_completo}`,
                            `- **${geoLog}**`,
                            ...jobInfo,
                        ].join("\n"),
                    }],
                structuredContent: { ordem_instalacao: data, job: job ?? null, geocodificacao: geo },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // â•â•â• croma_listar_equipes â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    server.registerTool("croma_listar_equipes", {
        title: "Listar Equipes de Campo",
        description: `Lista equipes de instalaÃ§Ã£o/campo com seus membros.

Use para "equipes disponÃ­veis", "quem estÃ¡ na equipe X", "equipes por regiÃ£o".

Args:
  - response_format ('markdown'|'json'): PadrÃ£o markdown`,
        inputSchema: z.object({
            response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (params) => {
        try {
            const sb = getAdminClient();
            const { data, error } = await sb
                .from("equipes")
                .select("id, nome, regiao, ativo, equipe_membros(id, funcao, ativo, profiles(full_name))")
                .eq("ativo", true)
                .order("nome");
            if (error)
                return errorResult(error);
            const items = data ?? [];
            let text;
            if (params.response_format === ResponseFormat.MARKDOWN) {
                const lines = [`## Equipes de Campo (${items.length})`, ""];
                if (items.length === 0) {
                    lines.push("_Nenhuma equipe cadastrada._");
                }
                else {
                    for (const e of items) {
                        const membros = e.equipe_membros ?? [];
                        const membrosAtivos = membros.filter(m => m.ativo !== false);
                        lines.push(`### ${e.nome}${e.regiao ? ` â€” ${e.regiao}` : ""}`);
                        lines.push(`- **ID**: \`${e.id}\``);
                        lines.push(`- **Membros**: ${membrosAtivos.length}`);
                        for (const m of membrosAtivos) {
                            const nome = m.profiles?.full_name ?? "â€”";
                            lines.push(`  - ${nome}${m.funcao ? ` (${m.funcao})` : ""}`);
                        }
                        lines.push("");
                    }
                }
                text = lines.join("\n");
            }
            else {
                text = JSON.stringify({ count: items.length, items }, null, 2);
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: { count: items.length, items },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ===========================================================================
    // croma_upload_anexo_job â€” Sobe foto de referÃªncia/arte/impresso para um job
    // ===========================================================================
    server.tool("croma_upload_anexo_job", "Faz upload de anexo (foto de referÃªncia do local, arte aprovada ou foto do material impresso) para um job do App Campo. Aceita arquivo em base64.", {
        job_id: z.string().uuid().describe("ID do job"),
        tipo: z.enum(["referencia_local", "arte_aprovada", "foto_impresso"]).describe("Tipo do anexo"),
        file_base64: z.string().describe("ConteÃºdo do arquivo em base64"),
        file_name: z.string().describe("Nome original do arquivo (ex: vitrine-recco.jpg)"),
        description: z.string().optional().describe("Legenda ou descriÃ§Ã£o do arquivo"),
        pedido_id: z.string().uuid().optional().describe("ID do pedido (para vincular)"),
        ordem_instalacao_id: z.string().uuid().optional().describe("ID da ordem de instalaÃ§Ã£o (para vincular)"),
    }, async (params) => {
        try {
            const admin = getAdminClient();
            const user = getUserClient();
            // Detectar extensÃ£o e mime_type
            const ext = params.file_name.split(".").pop()?.toLowerCase() ?? "jpg";
            const mimeMap = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                webp: "image/webp",
                pdf: "application/pdf",
            };
            const mimeType = mimeMap[ext] ?? "image/jpeg";
            // Decodificar base64
            const buffer = Buffer.from(params.file_base64, "base64");
            const fileSize = buffer.length;
            // Naming convention: {job_id}/{tipo}_{timestamp}_{random}.{ext}
            const timestamp = Date.now();
            const rand = Math.floor(Math.random() * 1000);
            const storagePath = `${params.job_id}/${params.tipo}_${timestamp}_${rand}.${ext}`;
            // Upload para Storage (admin client para bypassar RLS do storage)
            const { error: uploadError } = await admin.storage
                .from("job-attachments")
                .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: false,
            });
            if (uploadError)
                return errorResult(uploadError);
            // Pegar URL pÃºblica
            const { data: urlData } = admin.storage
                .from("job-attachments")
                .getPublicUrl(storagePath);
            const fileUrl = urlData.publicUrl;
            // INSERT em job_attachments
            const { data: attachment, error: insertError } = await admin
                .from("job_attachments")
                .insert({
                job_id: params.job_id,
                tipo: params.tipo,
                file_url: fileUrl,
                file_name: params.file_name,
                file_size: fileSize,
                mime_type: mimeType,
                description: params.description ?? null,
                uploaded_by_name: "Claudete (MCP)",
                source: "mcp",
                ordem_instalacao_id: params.ordem_instalacao_id ?? null,
                pedido_id: params.pedido_id ?? null,
            })
                .select()
                .single();
            if (insertError)
                return errorResult(insertError);
            const tipoLabels = {
                referencia_local: "ðŸ“ ReferÃªncia do Local",
                arte_aprovada: "ðŸŽ¨ Arte Aprovada",
                foto_impresso: "ðŸ–¨ï¸ Material Impresso",
            };
            const text = [
                `âœ… Anexo enviado com sucesso!`,
                `- **Tipo**: ${tipoLabels[params.tipo]}`,
                `- **Arquivo**: ${params.file_name} (${(fileSize / 1024).toFixed(1)} KB)`,
                `- **URL**: ${fileUrl}`,
                `- **ID**: \`${attachment.id}\``,
            ].join("\n");
            return {
                content: [{ type: "text", text }],
                structuredContent: { id: attachment.id, file_url: fileUrl, tipo: params.tipo },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    // ===========================================================================
    // croma_listar_anexos_job â€” Lista anexos de referÃªncia de um job
    // ===========================================================================
    server.tool("croma_listar_anexos_job", "Lista os anexos de referÃªncia (fotos do local, arte aprovada, fotos do impresso) de um job do App Campo.", {
        job_id: z.string().uuid().describe("ID do job"),
        tipo: z.enum(["referencia_local", "arte_aprovada", "foto_impresso"]).optional().describe("Filtrar por tipo (opcional)"),
    }, async (params) => {
        try {
            const admin = getAdminClient();
            let query = admin
                .from("job_attachments")
                .select("id, tipo, file_url, file_name, file_size, mime_type, description, uploaded_by_name, source, created_at")
                .eq("job_id", params.job_id)
                .is("deleted_at", null)
                .order("tipo")
                .order("created_at", { ascending: true });
            if (params.tipo) {
                query = query.eq("tipo", params.tipo);
            }
            const { data, error } = await query;
            if (error)
                return errorResult(error);
            const items = data ?? [];
            const tipoLabels = {
                referencia_local: "ðŸ“ ReferÃªncia do Local",
                arte_aprovada: "ðŸŽ¨ Arte Aprovada",
                foto_impresso: "ðŸ–¨ï¸ Material Impresso",
            };
            const lines = [`## Anexos do Job (${items.length})`, ""];
            if (items.length === 0) {
                lines.push("_Nenhum anexo cadastrado para este job._");
            }
            else {
                const grouped = {};
                for (const item of items) {
                    if (!grouped[item.tipo])
                        grouped[item.tipo] = [];
                    grouped[item.tipo].push(item);
                }
                for (const [tipo, anexos] of Object.entries(grouped)) {
                    lines.push(`### ${tipoLabels[tipo] ?? tipo} (${anexos.length})`);
                    for (const a of anexos) {
                        const kb = a.file_size ? ` â€¢ ${(a.file_size / 1024).toFixed(0)} KB` : "";
                        lines.push(`- **${a.file_name ?? "arquivo"}**${kb}`);
                        if (a.description)
                            lines.push(`  - _${a.description}_`);
                        lines.push(`  - Enviado por: ${a.uploaded_by_name ?? "â€“"} | ${formatDateTime(a.created_at)}`);
                        lines.push(`  - URL: ${a.file_url}`);
                        lines.push(`  - ID: \`${a.id}\``);
                    }
                    lines.push("");
                }
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
                structuredContent: { count: items.length, items },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=campo.js.map
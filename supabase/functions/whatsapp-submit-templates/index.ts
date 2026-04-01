// whatsapp-submit-templates v1
// Submete templates de mensagem do WhatsApp à Meta Business API
// WA-02 — Templates para mensagens proativas (croma_abertura, croma_followup)
// Ref: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates pré-definidos da Croma Print
const CROMA_TEMPLATES = [
  {
    name: "croma_abertura",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Croma Print — Comunicação Visual",
      },
      {
        type: "BODY",
        text: "Olá {{1}}! 👋\n\nSou da *Croma Print*, especialistas em comunicação visual para redes de lojas, franquias e indústria.\n\nProduzimos fachadas em ACM, banners, material PDV, letreiros e muito mais — com produção própria e atendimento nacional.\n\nPosso te ajudar com algum projeto?",
        example: {
          body_text: [["João"]],
        },
      },
      {
        type: "FOOTER",
        text: "Croma Print Comunicação Visual",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: "Quero um orçamento",
          },
          {
            type: "QUICK_REPLY",
            text: "Conheço a Croma",
          },
        ],
      },
    ],
  },
  {
    name: "croma_followup",
    category: "MARKETING",
    language: "pt_BR",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Croma Print — Acompanhamento",
      },
      {
        type: "BODY",
        text: "Oi {{1}}, tudo bem? 😊\n\nEstou passando para saber se ainda tem interesse no projeto de comunicação visual que conversamos.\n\nTemos disponibilidade para produção imediata e posso preparar uma proposta personalizada.\n\nPosso ajudar?",
        example: {
          body_text: [["Maria"]],
        },
      },
      {
        type: "FOOTER",
        text: "Croma Print Comunicação Visual",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "QUICK_REPLY",
            text: "Sim, quero proposta",
          },
          {
            type: "QUICK_REPLY",
            text: "Agora não, obrigado",
          },
        ],
      },
    ],
  },
  {
    name: "croma_proposta",
    category: "UTILITY",
    language: "pt_BR",
    components: [
      {
        type: "BODY",
        text: "Olá {{1}}! 📋\n\nSua proposta da *Croma Print* está pronta!\n\n💰 Valor: *{{2}}*\n📎 Acesse aqui: {{3}}\n\nQualquer dúvida, é só responder esta mensagem.\n\n*Formas de pagamento:*\n• PIX: CNPJ 18.923.994/0001-83\n• Boleto bancário\n• Transferência",
        example: {
          body_text: [["João", "R$ 5.000,00", "https://crm-croma.vercel.app/p/abc123"]],
        },
      },
      {
        type: "FOOTER",
        text: "junior@cromaprint.com.br",
      },
    ],
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar credenciais WhatsApp do admin_config
    const { data: configs } = await supabase
      .from("admin_config")
      .select("chave, valor")
      .in("chave", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_WABA_ID"]);

    const configMap: Record<string, string> = {};
    configs?.forEach((c: { chave: string; valor: string }) => {
      configMap[c.chave] = c.valor;
    });

    const accessToken = configMap.WHATSAPP_ACCESS_TOKEN;
    const wabaId = configMap.WHATSAPP_WABA_ID || "1262844242060742";

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "WHATSAPP_ACCESS_TOKEN não configurado no admin_config" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se quer submeter template específico ou todos
    let body: { template_name?: string } = {};
    try {
      body = await req.json();
    } catch {
      // sem body = submeter todos
    }

    const templatesToSubmit = body.template_name
      ? CROMA_TEMPLATES.filter((t) => t.name === body.template_name)
      : CROMA_TEMPLATES;

    if (templatesToSubmit.length === 0) {
      return new Response(
        JSON.stringify({ error: `Template '${body.template_name}' não encontrado` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const template of templatesToSubmit) {
      try {
        // Submeter à Meta API v22.0
        const response = await fetch(
          `https://graph.facebook.com/v22.0/${wabaId}/message_templates`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(template),
          }
        );

        const data = await response.json();

        results.push({
          template: template.name,
          success: response.ok,
          status: response.status,
          data,
        });

        // Registrar evento no sistema
        await supabase.from("system_events").insert({
          event_type: "whatsapp_template_submitted",
          entity_type: "whatsapp_template",
          entity_id: data.id || template.name,
          payload: {
            template_name: template.name,
            category: template.category,
            success: response.ok,
            meta_response: data,
          },
        });
      } catch (err) {
        results.push({
          template: template.name,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        message: allSuccess
          ? `${results.length} template(s) submetido(s) com sucesso à Meta`
          : "Alguns templates falharam — verifique os detalhes",
        results,
      }),
      {
        status: allSuccess ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

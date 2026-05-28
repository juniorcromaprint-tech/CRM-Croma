// whatsapp-enviar-audio v2 (2026-05-22) — OGG/Opus em vez de MP3
// v1 (MP3) gerou wamid OK mas Meta rejeitou na entrega (Cloud API prefere voice msg em OGG/Opus).
// v2: ElevenLabs ?output_format=opus_48000_128 + upload Meta audio/ogg.
// Input: { "to": "<phone_e164>", "text": "<texto_pra_TTS>", "voice_id"?: "<override>" }
// Output: { "success": true, "media_id": "...", "whatsapp_message_id": "..." }

const ELEVENLABS_VOICE_ID = "GDzHdQOi6jjf8zaXhCYD";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";

function preparTextoVoz(texto: string): string {
  let t = texto;
  t = t.replace(/\*\*(.+?)\*\*/g, "$1");
  t = t.replace(/\*(.+?)\*/g, "$1");
  t = t.replace(/`{1,3}(.+?)`{1,3}/g, "$1");
  t = t.replace(/^#{1,6}\s*/gm, "");
  t = t.replace(/_{1,2}(.+?)_{1,2}/g, "$1");
  t = t.replace(/~{1,2}(.+?)~{1,2}/g, "$1");
  t = t.replace(/\[(.+?)\]\(https?:\/\/\S+\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/g, "link disponivel");
  const emojiMap: Record<string, string> = {
    "✅": "pronto,", "⚠️": "atencao,", "🔴": "", "🟡": "", "🟢": "",
    "📅": "", "🎯": "", "💰": "", "📊": "", "🔔": "",
    "👋": "", "👍": "ok,", "❌": "nao,", "🚨": "urgente,",
    "📍": "", "🏠": "", "📞": "", "✉️": "", "🔑": "",
    "⏰": "", "📝": "", "💡": "", "🔧": "", "📦": "",
    "🗓️": "", "📌": "", "🛵": "moto,", "🏗️": "",
  };
  for (const [e, p] of Object.entries(emojiMap)) t = t.split(e).join(p);
  t = t.replace(/R\$\s*/g, "reais ");
  t = t.replace(/(\d)\.(\d{3})/g, "$1$2");
  t = t.replace(/(\d+),(\d{2})(?=\s|$|[^0-9])/g, "$1 reais e $2 centavos");
  const meses = ["", "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  t = t.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_m: string, d: string, mes: string, ano: string) => `${parseInt(d)} de ${meses[parseInt(mes)]} de ${ano}`);
  t = t.replace(/(\d{1,2}):(\d{2})/g, "$1 horas e $2 minutos");
  t = t.replace(/ OS /g, " ordem de servico ").replace(/OS-/g, "ordem de servico ");
  t = t.replace(/INST-/g, "instalacao ").replace(/PED-/g, "pedido ");
  t = t.replace(/NF-e/g, "nota fiscal").replace(/NF /g, "nota fiscal ");
  t = t.replace(/ SP/g, " Sao Paulo").replace(/ RJ/g, " Rio de Janeiro");
  t = t.replace(/ \/ /g, " por ").replace(/ - /g, ", ");
  t = t.replace(/-{2,}/g, ",").replace(/\|/g, ",").replace(/[\[\]{}]/g, "");
  t = t.replace(/\n{2,}/g, ". ").replace(/\n/g, ", ").replace(/\s{2,}/g, " ");
  t = t.replace(/,\s*,/g, ",").replace(/\.\s*\./g, ".").trim();
  if (t.length > 1200) t = t.slice(0, 1197) + "...";
  return t;
}

async function gerarAudioElevenLabs(apiKey: string, texto: string, voiceId: string): Promise<Uint8Array | null> {
  const textoLimpo = preparTextoVoz(texto);
  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=opus_48000_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/ogg",
    },
    body: JSON.stringify({
      text: textoLimpo,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.80,
        style: 0.35,
        use_speaker_boost: true,
        speed: 1.05,
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`ElevenLabs erro ${resp.status}: ${err.slice(0, 300)}`);
    return null;
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log(`ElevenLabs OGG OK: ${buf.length} bytes (texto ${textoLimpo.length} chars)`);
  return buf;
}

async function uploadMetaMedia(audioBytes: Uint8Array, phoneNumberId: string, accessToken: string): Promise<string | null> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio/ogg");
  form.append("file", new Blob([audioBytes as unknown as BlobPart], { type: "audio/ogg" }), "audio.ogg");
  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Meta media upload erro ${resp.status}: ${err.slice(0, 400)}`);
    return null;
  }
  const data = await resp.json();
  console.log(`Meta media upload OK: id=${data.id}`);
  return data.id ?? null;
}

async function sendAudioMessage(to: string, mediaId: string, phoneNumberId: string, accessToken: string): Promise<string | null> {
  const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "audio",
      audio: { id: mediaId },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Meta send audio erro ${resp.status}: ${err.slice(0, 400)}`);
    return null;
  }
  const data = await resp.json();
  const wamid = data.messages?.[0]?.id;
  console.log(`Meta send audio OK: wamid=${wamid}`);
  return wamid ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 }); }
  const { to, text, voice_id } = body ?? {};
  if (!to || !text) {
    return new Response(JSON.stringify({ error: "to e text obrigatorios" }), { status: 400 });
  }
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!elevenKey) return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }), { status: 500 });
  if (!accessToken || !phoneNumberId) return new Response(JSON.stringify({ error: "WHATSAPP_ACCESS_TOKEN ou PHONE_NUMBER_ID not set" }), { status: 500 });
  try {
    const audio = await gerarAudioElevenLabs(elevenKey, text, voice_id || ELEVENLABS_VOICE_ID);
    if (!audio) return new Response(JSON.stringify({ error: "ElevenLabs falhou" }), { status: 502 });
    const mediaId = await uploadMetaMedia(audio, phoneNumberId, accessToken);
    if (!mediaId) return new Response(JSON.stringify({ error: "Meta media upload falhou" }), { status: 502 });
    const wamid = await sendAudioMessage(to, mediaId, phoneNumberId, accessToken);
    if (!wamid) return new Response(JSON.stringify({ error: "Meta send audio falhou", media_id: mediaId }), { status: 502 });
    return new Response(JSON.stringify({
      success: true,
      audio_bytes: audio.length,
      media_id: mediaId,
      whatsapp_message_id: wamid,
      to,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("whatsapp-enviar-audio erro:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), { status: 500 });
  }
});

-- ============================================================================
-- Migration: version_fn_notificar_nova_oi  (fecha INSTAL-04 — drift source<->DB)
-- Data: 2026-05-29  | Ciclo autonomo #30 (rotacao SEXTA = Instalacao)
-- ----------------------------------------------------------------------------
-- CONTEXTO (INSTAL-04, auditorias #27/#29):
--   O evento system_events 'installation_order_auto_created' (22 emitidos
--   lifetime, ultimo 2026-05-28 17:04:23 UTC / 14:04 BRT) e emitido por
--   public.fn_notificar_nova_oi() via trigger trg_notificar_nova_oi AFTER INSERT
--   em ordens_instalacao. Essa funcao + trigger EXISTIAM em producao mas NAO
--   constavam em nenhuma migration versionada (so havia spec nao-executavel em
--   docs/.../FASE-3-AUTOMACAO-FLUXO). Drift source<->DB = DB-only.
--
-- ESTE ARQUIVO:
--   Captura VERBATIM a definicao viva (via pg_get_functiondef / pg_get_triggerdef
--   em 2026-05-29) e a versiona como migration idempotente. Como o corpo foi
--   extraido do proprio banco de producao, applied == versioned por construcao.
--
-- NOTA DE APLICACAO (ciclo #30):
--   NAO re-aplicado neste ciclo. Re-aplicar CREATE OR REPLACE com corpo
--   byte-identico ao vivo e no-op funcional; a funcao e SECURITY DEFINER e o
--   ciclo rodou de madrugada nao-monitorado (03:xx BRT) sem urgencia (a chain
--   funciona — 22 eventos). Esta migration e idempotente e segura pra re-aplicar
--   em janela monitorada se desejado (CREATE OR REPLACE FUNCTION + DROP/CREATE
--   TRIGGER). Verificar com pg_get_functiondef pos-apply que SECURITY DEFINER e
--   search_path foram preservados.
--
-- INVARIANTE: idempotente. Re-aplicacao com corpo identico = no-op.
-- ============================================================================

-- 1) Emitter (SECURITY DEFINER, search_path fixo) — verbatim do live
CREATE OR REPLACE FUNCTION public.fn_notificar_nova_oi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_cliente TEXT; v_pedido TEXT;
BEGIN
  SELECT c.nome_fantasia INTO v_cliente FROM clientes c WHERE c.id = NEW.cliente_id;
  SELECT p.numero INTO v_pedido FROM pedidos p WHERE p.id = NEW.pedido_id;

  INSERT INTO system_events (event_type, entity_type, entity_id, payload)
  VALUES ('installation_order_auto_created', 'ordem_instalacao', NEW.id,
    jsonb_build_object('pedido_id',NEW.pedido_id,'pedido_numero',COALESCE(v_pedido,''),
      'cliente_id',NEW.cliente_id,'cliente_nome',COALESCE(v_cliente,''),
      'auto_generated',true,'notificar_junior',true));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[OI-NOTIFY] Erro: %', SQLERRM; RETURN NEW;
END;
$function$;

-- 2) Trigger AFTER INSERT em ordens_instalacao — verbatim do live (idempotente)
DROP TRIGGER IF EXISTS trg_notificar_nova_oi ON public.ordens_instalacao;
CREATE TRIGGER trg_notificar_nova_oi
  AFTER INSERT ON public.ordens_instalacao
  FOR EACH ROW EXECUTE FUNCTION fn_notificar_nova_oi();

COMMENT ON FUNCTION public.fn_notificar_nova_oi() IS
  'Emite system_event installation_order_auto_created em nova OI. Versionado no ciclo autonomo #30 (2026-05-29) — fecha drift INSTAL-04 (capturado verbatim do live via pg_get_functiondef).';

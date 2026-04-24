-- Fix IP tracking: accept real IP from Edge Function instead of inet_client_addr() which returns ::1
-- The resolve-geo Edge Function now returns the real client IP from x-forwarded-for/cf-connecting-ip headers
-- Frontend passes this IP to the RPC, which stores it directly

-- Drop old overload (8 params without p_ip_address) to avoid ambiguity
DROP FUNCTION IF EXISTS public.portal_register_view(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.portal_register_view(
  p_token UUID, p_session_id TEXT, p_device_type TEXT,
  p_browser TEXT, p_os TEXT, p_ip_address TEXT DEFAULT NULL,
  p_geo_city TEXT DEFAULT NULL, p_geo_region TEXT DEFAULT NULL,
  p_geo_country TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE v_proposta_id UUID; v_view_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  INSERT INTO proposta_views (proposta_id, session_id, ip_address, device_type, browser, os, geo_city, geo_region, geo_country)
  VALUES (v_proposta_id, p_session_id, CASE WHEN p_ip_address IS NOT NULL AND p_ip_address != '' THEN p_ip_address::inet ELSE inet_client_addr() END, p_device_type, p_browser, p_os, p_geo_city, p_geo_region, p_geo_country)
  RETURNING id INTO v_view_id;
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

// src/domains/portal/services/tracking.service.ts
import { supabase } from '@/integrations/supabase/client';

export async function registerView(params: {
  token: string;
  sessionId: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('portal_register_view', {
    p_token: params.token,
    p_session_id: params.sessionId,
    p_device_type: params.deviceType,
    p_browser: params.browser,
    p_os: params.os,
    p_ip_address: params.ipAddress || null,
    p_geo_city: params.geoCity || null,
    p_geo_region: params.geoRegion || null,
    p_geo_country: params.geoCountry || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function sendHeartbeat(params: {
  token: string;
  viewId: string;
  durationSeconds: number;
  maxScrollDepth: number;
  clickedItems: Array<{ item_id: string; timestamp: number }>;
  downloadedPdf: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('portal_heartbeat', {
    p_token: params.token,
    p_view_id: params.viewId,
    p_duration_seconds: params.durationSeconds,
    p_max_scroll_depth: params.maxScrollDepth,
    p_clicked_items: JSON.stringify(params.clickedItems),
    p_downloaded_pdf: params.downloadedPdf,
  });
  // Heartbeat failures are non-critical — don't throw
}

export async function resolveGeo(): Promise<{ ip: string; city: string; region: string; country: string } | null> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-geo`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// src/domains/portal/hooks/usePortalTracking.ts
import { useEffect, useRef, useCallback } from 'react';
import { registerView, sendHeartbeat, resolveGeo } from '../services/tracking.service';

function getOrCreateSessionId(): string {
  const key = 'portal_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function parseDevice(): { deviceType: string; browser: string; os: string } {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  let os = 'unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { deviceType, browser, os };
}

export function usePortalTracking(token: string) {
  const viewIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(Date.now());
  const scrollRef = useRef(0);
  const clicksRef = useRef<Array<{ item_id: string; timestamp: number }>>([]);
  const pdfRef = useRef(false);

  // Register view on mount
  useEffect(() => {
    if (!token) return;

    const init = async () => {
      const device = parseDevice();
      const geo = await resolveGeo();

      try {
        const viewId = await registerView({
          token,
          sessionId: getOrCreateSessionId(),
          ...device,
          ipAddress: geo?.ip,
          geoCity: geo?.city,
          geoRegion: geo?.region,
          geoCountry: geo?.country,
        });
        viewIdRef.current = viewId;
      } catch (err) {
      }
    };

    init();
  }, [token]);

  // Scroll tracking
  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrollTop / docHeight) * 100);
        scrollRef.current = Math.max(scrollRef.current, pct);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Heartbeat every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendHeartbeat({
        token,
        viewId: viewIdRef.current,
        durationSeconds: duration,
        maxScrollDepth: scrollRef.current,
        clickedItems: clicksRef.current,
        downloadedPdf: pdfRef.current,
      });
    }, 30_000);

    return () => clearInterval(interval);
  }, [token]);

  // Final beacon on unload
  useEffect(() => {
    const flush = () => {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      const body = JSON.stringify({
        p_token: token,
        p_view_id: viewIdRef.current,
        p_duration_seconds: duration,
        p_max_scroll_depth: scrollRef.current,
        p_clicked_items: JSON.stringify(clicksRef.current),
        p_downloaded_pdf: pdfRef.current,
      });
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/portal_heartbeat`,
        new Blob([body], { type: 'application/json' })
      );
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', flush);

    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', flush);
    };
  }, [token]);

  const trackClick = useCallback((itemId: string) => {
    clicksRef.current.push({ item_id: itemId, timestamp: Date.now() });
  }, []);

  const trackPdfDownload = useCallback(() => {
    pdfRef.current = true;
  }, []);

  return { trackClick, trackPdfDownload };
}

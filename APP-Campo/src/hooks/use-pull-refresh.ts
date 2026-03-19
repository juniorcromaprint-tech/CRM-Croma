import { useState, useRef, useCallback } from "react";

interface PullRefreshHandlers {
  isRefreshing: boolean;
  pullDistance: number;
  threshold: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export function usePullRefresh(onRefresh: () => Promise<void>): PullRefreshHandlers {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isAtTop = useRef(false);

  const THRESHOLD = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLElement;
    isAtTop.current = el.scrollTop === 0;
    if (isAtTop.current) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isAtTop.current || !startY.current) return;
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop > 0) {
      isAtTop.current = false;
      setPullDistance(0);
      return;
    }
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, THRESHOLD * 1.5));
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    startY.current = 0;
    isAtTop.current = false;
  }, [pullDistance, isRefreshing, onRefresh]);

  return { isRefreshing, pullDistance, onTouchStart, onTouchMove, onTouchEnd, threshold: THRESHOLD };
}

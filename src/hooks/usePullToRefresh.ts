import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh for a scroll container. Attach the returned ref to a
 * vertically scrollable element. `onRefresh` runs when the user pulls
 * past `threshold` (default 70px) while at scrollTop = 0.
 */
export function usePullToRefresh<T extends HTMLElement>(
  onRefresh: () => Promise<void> | void,
  threshold = 70
) {
  const ref = useRef<T | null>(null);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startY = 0;
    let pulling = false;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { setPullPx(0); return; }
      // Apply resistance so it feels natural
      const damped = Math.min(120, Math.pow(dy, 0.85));
      setPullPx(damped);
    };

    const onTouchEnd = async () => {
      if (!pulling) return;
      pulling = false;
      const reached = pullPx >= threshold;
      setPullPx(0);
      if (reached && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); } finally { setRefreshing(false); }
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, threshold, pullPx, refreshing]);

  return { ref, pullPx, refreshing, threshold };
}

import { useEffect, useRef, useState } from "react";

interface PinchZoomImageProps {
  src: string;
  alt?: string;
}

/**
 * Lightweight pinch-to-zoom + double-tap + pan image viewer.
 * No external deps. Works with mouse wheel + touch.
 */
export default function PinchZoomImage({ src, alt }: PinchZoomImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const stateRef = useRef({
    scale: 1, tx: 0, ty: 0,
    pinching: false,
    startDist: 0,
    startScale: 1,
    panning: false,
    panStartX: 0,
    panStartY: 0,
    panOriginTx: 0,
    panOriginTy: 0,
    lastTap: 0,
  });

  const apply = (s: number, x: number, y: number) => {
    stateRef.current.scale = s;
    stateRef.current.tx = x;
    stateRef.current.ty = y;
    setScale(s); setTx(x); setTy(y);
  };

  const reset = () => apply(1, 0, 0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        stateRef.current.pinching = true;
        stateRef.current.startDist = dist(e.touches[0], e.touches[1]);
        stateRef.current.startScale = stateRef.current.scale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - stateRef.current.lastTap < 300) {
          // double tap → toggle zoom
          if (stateRef.current.scale > 1.1) reset();
          else apply(2.5, 0, 0);
        }
        stateRef.current.lastTap = now;
        if (stateRef.current.scale > 1) {
          stateRef.current.panning = true;
          stateRef.current.panStartX = e.touches[0].clientX;
          stateRef.current.panStartY = e.touches[0].clientY;
          stateRef.current.panOriginTx = stateRef.current.tx;
          stateRef.current.panOriginTy = stateRef.current.ty;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && stateRef.current.pinching) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const s = Math.min(5, Math.max(1, stateRef.current.startScale * (d / stateRef.current.startDist)));
        apply(s, stateRef.current.tx, stateRef.current.ty);
      } else if (e.touches.length === 1 && stateRef.current.panning) {
        e.preventDefault();
        const dx = e.touches[0].clientX - stateRef.current.panStartX;
        const dy = e.touches[0].clientY - stateRef.current.panStartY;
        apply(stateRef.current.scale, stateRef.current.panOriginTx + dx, stateRef.current.panOriginTy + dy);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) stateRef.current.pinching = false;
      if (e.touches.length === 0) stateRef.current.panning = false;
      if (stateRef.current.scale < 1.05) reset();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const s = Math.min(5, Math.max(1, stateRef.current.scale + delta));
      apply(s, stateRef.current.tx, stateRef.current.ty);
    };

    const onDblClick = () => {
      if (stateRef.current.scale > 1.1) reset();
      else apply(2.5, 0, 0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full h-full flex items-center justify-center overflow-hidden touch-none select-none"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-[80vh] object-contain rounded-lg will-change-transform"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: stateRef.current.pinching || stateRef.current.panning ? "none" : "transform 0.18s ease-out",
        }}
      />
    </div>
  );
}

import { Package } from "lucide-react";
import { useRef } from "react";

import { frameFor, type PlacedDesign, type Placement } from "../../lib/designState";

export function DesignCanvas({
  baseImageUrl,
  design,
  placement,
  area,
  onImageLoad,
  onDragStart,
  onDragEnd,
  onPlacement,
}: {
  baseImageUrl: string | null;
  design: PlacedDesign | null;
  placement: Placement;
  area: string | null;
  onImageLoad: (img: HTMLImageElement) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onPlacement: (p: Placement) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const frame = frameFor(area);

  function toPct(clientX: number, clientY: number): { xPct: number; yPct: number } {
    const rect = ref.current!.getBoundingClientRect();
    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;
    return { xPct: Math.max(0, Math.min(100, xPct)), yPct: Math.max(0, Math.min(100, yPct)) };
  }

  return (
    <div ref={ref} className="relative aspect-square w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {baseImageUrl ? (
        <img src={baseImageUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-300">
          <Package className="h-12 w-12" />
        </div>
      )}

      {/* Print-area frame */}
      <div
        className="pointer-events-none absolute rounded border-2 border-dashed border-brand-400/70"
        style={{ left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.w}%`, height: `${frame.h}%` }}
      />

      {/* Design overlay (drag to move) */}
      {design && (
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            onDragStart();
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const { xPct, yPct } = toPct(e.clientX, e.clientY);
            onPlacement({ ...placement, xPct, yPct });
          }}
          onPointerUp={(e) => {
            if (!dragging.current) return;
            dragging.current = false;
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            onDragEnd();
          }}
          className="absolute cursor-move touch-none"
          style={{
            left: `${placement.xPct}%`,
            top: `${placement.yPct}%`,
            width: `${placement.scale * 100}%`,
            transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
          }}
        >
          <img
            src={design.resource_url}
            alt="Your design"
            draggable={false}
            onLoad={(e) => onImageLoad(e.currentTarget)}
            className="pointer-events-none h-auto w-full ring-1 ring-brand-300/50"
          />
        </div>
      )}
    </div>
  );
}

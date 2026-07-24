import { Package } from "lucide-react";

import { cn } from "../../lib/cn";

/** A composite thumbnail: the design overlaid on the blank at its stored placement
 * (a lightweight stand-in for real mockups — mockup seam #2). */
export function DesignPreviewThumb({
  baseImageUrl,
  designUrl,
  pos_x,
  pos_y,
  scale,
  rotation,
  className,
}: {
  baseImageUrl: string | null;
  designUrl: string | null;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-slate-100", className)}>
      {baseImageUrl ? (
        <img src={baseImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-300">
          <Package className="h-8 w-8" />
        </div>
      )}
      {designUrl && (
        <img
          src={designUrl}
          alt=""
          loading="lazy"
          className="absolute"
          style={{
            left: `${pos_x}%`,
            top: `${pos_y}%`,
            width: `${scale * 100}%`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        />
      )}
    </div>
  );
}

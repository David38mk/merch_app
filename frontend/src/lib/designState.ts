// Editor state for the design step: which artwork, where it sits, on which area/color.

export interface Placement {
  xPct: number; // design centre X, % of canvas
  yPct: number; // design centre Y, % of canvas
  scale: number; // design width as a fraction of canvas width
  rotation: number; // degrees
}

export interface PlacedDesign {
  id: string;
  resource_url: string;
  source: string;
}

export interface EditorState {
  design: PlacedDesign | null;
  area: string | null;
  color: string;
  placement: Placement;
}

// Print-area frames as % rectangles on the (single) blank photo. Approximate —
// realistic per-area/per-angle mockups are the deferred mockup seam (#2).
export const AREA_FRAMES: Record<string, { x: number; y: number; w: number; h: number }> = {
  Front: { x: 24, y: 22, w: 52, h: 54 },
  Back: { x: 24, y: 20, w: 52, h: 58 },
  Sleeve: { x: 40, y: 34, w: 20, h: 18 },
  Wrap: { x: 12, y: 32, w: 76, h: 38 },
};
export const DEFAULT_FRAME = { x: 24, y: 22, w: 52, h: 54 };

export function frameFor(area: string | null) {
  return (area && AREA_FRAMES[area]) || DEFAULT_FRAME;
}

export function centeredPlacement(area: string | null, scale = 0.45): Placement {
  const f = frameFor(area);
  return { xPct: f.x + f.w / 2, yPct: f.y + f.h / 2, scale, rotation: 0 };
}

// ── autosave (localStorage) ────────────────────────────────────────────────────

const key = (baseId: string) => `mhc:design:${baseId}`;

export function loadEditor(baseId: string): EditorState | null {
  try {
    const raw = localStorage.getItem(key(baseId));
    return raw ? (JSON.parse(raw) as EditorState) : null;
  } catch {
    return null;
  }
}

export function saveEditor(baseId: string, state: EditorState): void {
  try {
    localStorage.setItem(key(baseId), JSON.stringify(state));
  } catch {
    /* best-effort */
  }
}

export function clearEditor(baseId: string): void {
  try {
    localStorage.removeItem(key(baseId));
  } catch {
    /* ignore */
  }
}

// ── image analysis + warnings ───────────────────────────────────────────────────

export interface ImageMeta {
  naturalW: number;
  naturalH: number;
  hasAlpha: boolean;
  isSvg: boolean;
}

const MIN_EDGE_PX = 1200; // below this the artwork may print blurry

export function isSvgUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".svg");
}

/** Read the artwork's resolution + whether it has any transparency (canvas sample). */
export function analyzeImage(img: HTMLImageElement, isSvg: boolean): ImageMeta {
  const naturalW = img.naturalWidth || 0;
  const naturalH = img.naturalHeight || 0;
  let hasAlpha = false;
  if (!isSvg) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(naturalW, 64) || 1;
      canvas.height = Math.min(naturalH, 64) || 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 250) {
            hasAlpha = true;
            break;
          }
        }
      }
    } catch {
      hasAlpha = true; // cross-origin taint → don't nag
    }
  }
  return { naturalW, naturalH, hasAlpha, isSvg };
}

export interface Warning {
  key: string;
  label: string;
}

export function computeWarnings(meta: ImageMeta | null, placement: Placement, area: string | null): Warning[] {
  if (!meta) return [];
  const out: Warning[] = [];

  if (!meta.isSvg && Math.max(meta.naturalW, meta.naturalH) < MIN_EDGE_PX) {
    out.push({ key: "low-res", label: "Resolution is low — this may print blurry. Use a larger image." });
  }
  if (!meta.isSvg && !meta.hasAlpha) {
    out.push({ key: "no-alpha", label: "No transparent background detected — the image's background will print." });
  }

  // Bounding box vs the print-area frame (rotation ignored for the check).
  const aspect = meta.naturalW && meta.naturalH ? meta.naturalH / meta.naturalW : 1;
  const wPct = placement.scale * 100;
  const hPct = wPct * aspect;
  const left = placement.xPct - wPct / 2;
  const right = placement.xPct + wPct / 2;
  const top = placement.yPct - hPct / 2;
  const bottom = placement.yPct + hPct / 2;
  const f = frameFor(area);
  if (left < f.x - 0.5 || right > f.x + f.w + 0.5 || top < f.y - 0.5 || bottom > f.y + f.h + 0.5) {
    out.push({ key: "exceeds", label: "Design extends past the print area — resize or reposition it." });
  }

  return out;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Loader2,
  RefreshCw,
  Replace,
  RotateCw,
  Scaling,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { getBaseItem } from "../../../api/catalog";
import { generateDesigns, getCredits, getRecentDesigns, uploadDesign, type Design } from "../../../api/designs";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { DesignCanvas } from "../../../components/design/DesignCanvas";
import { cn } from "../../../lib/cn";
import { colorHex, isLightColor } from "../../../lib/colorHex";
import {
  analyzeImage,
  centeredPlacement,
  computeWarnings,
  frameFor,
  isSvgUrl,
  loadEditor,
  saveEditor,
  type EditorState,
  type ImageMeta,
  type PlacedDesign,
  type Placement,
} from "../../../lib/designState";
import type { ProductConfig } from "../../../lib/productConfig";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_MB = 5;

/** What the editor is opened with. `editing` is set when an existing product
 * sent us here to change its artwork. */
export interface EditorNavState {
  config?: ProductConfig;
  editing?: {
    productId: string;
    productName: string;
    design: PlacedDesign | null;
    placement: Placement;
    area: string | null;
    color: string;
  };
}

export default function DesignEditor() {
  const { baseItemId = "" } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Two callers: the creation flow (config from the catalog, continues to
  // /products/new) and the product editor (`editing` carries the product's
  // current artwork in, and Done hands the result back to the edit page).
  const nav = (loc.state as EditorNavState | null) ?? {};
  const { config, editing } = nav;

  const { data: item, isLoading } = useQuery({
    queryKey: ["catalog-item", baseItemId],
    queryFn: () => getBaseItem(baseItemId),
  });

  // ── history state ──
  const [present, setPresent] = useState<EditorState | null>(null);
  const [past, setPast] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const before = useRef<EditorState | null>(null);

  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [tool, setTool] = useState<"upload" | "ai">("upload");
  const [prompt, setPrompt] = useState("");
  const [candidates, setCandidates] = useState<Design[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // init once the product loads (resume from autosave if present)
  useEffect(() => {
    if (item && present === null) {
      // Editing an existing product always starts from what's actually on it —
      // a stale creation-flow autosave for the same blank must not win.
      if (editing) {
        setPresent({
          design: editing.design,
          area: editing.area ?? item.print_areas[0] ?? null,
          color: editing.color || item.colors[0] || "",
          placement: editing.placement,
        });
        return;
      }
      const saved = loadEditor(baseItemId);
      const area = saved?.area ?? item.print_areas[0] ?? null;
      const color = saved?.color ?? config?.color ?? item.colors[0] ?? "";
      setPresent(saved ?? { design: null, area, color, placement: centeredPlacement(area) });
    }
  }, [item, present, baseItemId, config, editing]);

  // Autosave the creation draft only — editing a product must not overwrite a
  // half-finished new product that happens to use the same blank.
  useEffect(() => {
    if (present && !editing) saveEditor(baseItemId, present);
  }, [present, baseItemId, editing]);

  const credits = useQuery({ queryKey: ["design-credits"], queryFn: getCredits });
  const recent = useQuery({ queryKey: ["recent-designs"], queryFn: getRecentDesigns });

  // ── history helpers ──
  const live = (fn: (p: EditorState) => EditorState) => setPresent((p) => (p ? fn(p) : p));
  const commit = (fn: (p: EditorState) => EditorState) =>
    setPresent((p) => {
      if (!p) return p;
      setPast((pa) => [...pa, p]);
      setFuture([]);
      return fn(p);
    });
  const beginInteraction = () => {
    before.current = present;
  };
  const endInteraction = () => {
    if (before.current) {
      const snap = before.current;
      setPast((pa) => [...pa, snap]);
      setFuture([]);
      before.current = null;
    }
  };
  function undo() {
    if (!past.length || !present) return;
    setFuture((f) => [present, ...f]);
    setPresent(past[past.length - 1]);
    setPast((pa) => pa.slice(0, -1));
  }
  function redo() {
    if (!future.length || !present) return;
    setPast((pa) => [...pa, present]);
    setPresent(future[0]);
    setFuture((f) => f.slice(1));
  }

  // ── actions ──
  function placeDesign(d: Design) {
    setMeta(null);
    setError(null);
    commit((p) => ({
      ...p,
      design: { id: d.id, resource_url: d.resource_url, source: d.source },
      placement: centeredPlacement(p.area),
    }));
  }

  const uploadMut = useMutation({
    mutationFn: uploadDesign,
    onSuccess: (d) => {
      placeDesign(d);
      qc.invalidateQueries({ queryKey: ["recent-designs"] });
    },
    onError: () => setError("Upload failed — try a PNG, JPG, WebP or SVG."),
  });

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Design must be a PNG, JPG, WebP or SVG file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_MB} MB).`);
      return;
    }
    setError(null);
    uploadMut.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const generateMut = useMutation({
    mutationFn: generateDesigns,
    onSuccess: (res) => {
      setCandidates(res.candidates);
      qc.setQueryData(["design-credits"], res.credits_remaining);
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number } }).response?.status;
      setError(status === 402 ? "You're out of AI credits (they reset monthly)." : "Couldn't generate — try again.");
    },
  });

  const onImageLoad = (img: HTMLImageElement) => {
    if (present?.design) setMeta(analyzeImage(img, isSvgUrl(present.design.resource_url)));
  };

  function centerDesign() {
    commit((p) => {
      const f = frameFor(p.area);
      return { ...p, placement: { ...p.placement, xPct: f.x + f.w / 2, yPct: f.y + f.h / 2 } };
    });
  }
  function removeDesign() {
    setMeta(null);
    commit((p) => ({ ...p, design: null }));
  }
  function replaceDesign() {
    removeDesign();
    setTool("upload");
  }

  function onContinue() {
    if (!present?.design) return;
    if (editing) {
      // Hand the result back; nothing is persisted until the seller saves there.
      navigate(`/seller/products/${editing.productId}/edit`, {
        state: {
          design: present.design,
          placement: present.placement,
          area: present.area,
          color: present.color,
        },
      });
      return;
    }
    navigate("/seller/products/new", {
      state: { config, design: present.design, placement: present.placement, area: present.area, color: present.color },
    });
  }

  if (isLoading || !item || !present) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const warnings = computeWarnings(meta, present.placement, present.area);
  const creditBalance = credits.data ?? 0;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={editing ? `/seller/products/${editing.productId}/edit` : `/seller/catalog/${baseItemId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {editing ? `Back to “${editing.productName}”` : "Back to product"}
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!past.length} title="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={!future.length} title="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button onClick={onContinue} disabled={!present.design}>
            {editing ? "Use this design" : "Continue"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div>
          <DesignCanvas
            baseImageUrl={item.image_url}
            design={present.design}
            placement={present.placement}
            area={present.area}
            onImageLoad={onImageLoad}
            onDragStart={beginInteraction}
            onDragEnd={endInteraction}
            onPlacement={(pl) => live((p) => ({ ...p, placement: pl }))}
          />
          <p className="mt-2 text-center text-xs text-slate-400">
            Illustrative preview — realistic mockups arrive with the mockup renderer.
          </p>

          {/* Print area (Front / Back / Side) */}
          {item.print_areas.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">View / print area</p>
              <div className="flex flex-wrap gap-2">
                {item.print_areas.map((a) => (
                  <button
                    key={a}
                    onClick={() => commit((p) => ({ ...p, area: a }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                      present.area === a
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {item.colors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Color</p>
              <div className="flex flex-wrap gap-2">
                {item.colors.map((c) => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => commit((p) => ({ ...p, color: c }))}
                    className={cn(
                      "h-8 w-8 rounded-full ring-2 ring-offset-2 transition",
                      present.color === c ? "ring-brand-500" : "ring-transparent",
                      isLightColor(c) && "border border-slate-200",
                    )}
                    style={{ backgroundColor: colorHex(c) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {warnings.map((w) => (
                <div key={w.key} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="space-y-5">
          {/* Adjust (only when a design is placed) */}
          {present.design && (
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900">Adjust</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Scaling className="h-4 w-4 text-slate-400" /> Size
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={present.placement.scale}
                    className="w-full accent-brand-600"
                    onPointerDown={beginInteraction}
                    onPointerUp={endInteraction}
                    onChange={(e) => live((p) => ({ ...p, placement: { ...p.placement, scale: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <RotateCw className="h-4 w-4 text-slate-400" /> Rotation
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={present.placement.rotation}
                    className="w-full accent-brand-600"
                    onPointerDown={beginInteraction}
                    onPointerUp={endInteraction}
                    onChange={(e) =>
                      live((p) => ({ ...p, placement: { ...p.placement, rotation: Number(e.target.value) } }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={centerDesign}>
                    <Crosshair className="h-4 w-4" /> Center
                  </Button>
                  <Button variant="outline" size="sm" onClick={replaceDesign}>
                    <Replace className="h-4 w-4" /> Replace
                  </Button>
                  <Button variant="ghost" size="sm" onClick={removeDesign}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Source: Upload / AI */}
          <Card className="p-5">
            <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {(["upload", "ai"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    tool === t ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {t === "upload" ? <Upload className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t === "upload" ? "Upload" : "AI generate"}
                </button>
              ))}
            </div>

            {tool === "upload" ? (
              <div>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadMut.isPending}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40"
                >
                  {uploadMut.isPending ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6" />
                      <span className="text-sm font-medium">Upload design</span>
                      <span className="text-xs text-slate-400">PNG, JPG, WebP or SVG · up to {MAX_MB} MB</span>
                    </>
                  )}
                </button>

                {recent.data && recent.data.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent uploads</p>
                    <div className="grid grid-cols-4 gap-2">
                      {recent.data.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => placeDesign(d)}
                          className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:border-brand-400"
                        >
                          <img src={d.resource_url} alt="" className="h-full w-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  className="input min-h-20 resize-y"
                  placeholder="Describe your artwork, e.g. 'retro sunset with palm trees, bold lines'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{creditBalance} AI credits left</span>
                  <Button
                    size="sm"
                    onClick={() => generateMut.mutate(prompt)}
                    disabled={generateMut.isPending || !prompt.trim() || creditBalance <= 0}
                  >
                    {generateMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {candidates.length ? "Regenerate" : "Generate"}
                  </Button>
                </div>

                {candidates.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Pick your favorite
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {candidates.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => placeDesign(d)}
                          className={cn(
                            "aspect-square overflow-hidden rounded-lg border-2 transition hover:border-brand-400",
                            present.design?.id === d.id ? "border-brand-500" : "border-slate-200",
                          )}
                        >
                          <img src={d.resource_url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => generateMut.mutate(prompt)}
                      disabled={generateMut.isPending || creditBalance <= 0}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate ({creditBalance} left)
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </Card>

          {!present.design && (
            <p className="text-center text-sm text-slate-400">Upload or generate a design to start placing it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

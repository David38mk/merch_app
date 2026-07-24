import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  Monitor,
  Rocket,
  Smartphone,
  Star,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  absoluteStoreUrl,
  discardDraft,
  getStorefront,
  publishStorefront,
  removeCover,
  removeLogo,
  saveDraft,
  unpublishStorefront,
  uploadCover,
  uploadLogo,
  type ButtonStyle,
  type StorefrontConfig,
  type StorefrontState,
} from "../../../api/storefront";
import { StorefrontView } from "../../../components/storefront/StorefrontView";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { PUBLISH_STATUS } from "../../../lib/publishStatus";
import { SOCIALS } from "../../../lib/socials";

const DESCRIPTION_MAX = 500;
const MAX_MB = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

const PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "Indigo", primary: "#6366f1", accent: "#ec4899" },
  { name: "Ocean", primary: "#0ea5e9", accent: "#f59e0b" },
  { name: "Forest", primary: "#16a34a", accent: "#84cc16" },
  { name: "Sunset", primary: "#f97316", accent: "#db2777" },
  { name: "Mono", primary: "#111827", accent: "#6b7280" },
];

const BUTTON_STYLES: ButtonStyle[] = ["rounded", "pill", "square"];

export default function SellerStorefront() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: state, isLoading } = useQuery({ queryKey: ["storefront"], queryFn: getStorefront });

  const [cfg, setCfg] = useState<StorefrontConfig | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const touched = useRef(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  // Latest cfg + pending debounce timer, so Publish can flush the autosave
  // instead of racing it (clicking Publish <1.5s after typing must not
  // publish the previous draft and drop the last keystrokes).
  const cfgRef = useRef<StorefrontConfig | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  // Hydrate the editor once (and after publish/discard, which reset the draft).
  useEffect(() => {
    if (state && !touched.current) {
      setCfg(state.config);
      setDirty(state.has_unpublished_changes);
    }
  }, [state]);

  const payloadFrom = (c: StorefrontConfig) => ({
    brand_name: c.brand_name ?? "",
    creator_name: c.creator_name ?? "",
    description: c.description ?? "",
    slug: c.slug ?? "",
    contact_email: c.contact_email ?? "",
    location: c.location ?? "",
    socials: Object.fromEntries(SOCIALS.map((s) => [s.key, c.socials[s.code] ?? ""])),
    theme: c.theme,
    curation: c.curation,
  });

  const save = useMutation({
    mutationFn: saveDraft,
    onSuccess: (s) => {
      // Adopt the server's view of blockers/slug availability/dirtiness —
      // without this the Publish button and slug check freeze on load-time state.
      qc.setQueryData(["storefront"], s);
      setDirty(s.has_unpublished_changes);
      setError(null);
    },
    onError: (e) => setError(apiError(e, "Autosave failed.")),
  });

  // Debounced autosave — draft only, never the live page.
  useEffect(() => {
    cfgRef.current = cfg;
    if (!cfg || !touched.current) return;
    saveTimer.current = setTimeout(() => save.mutate(payloadFrom(cfg)), 1500);
    return () => clearTimeout(saveTimer.current);
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch: Partial<StorefrontConfig>) {
    touched.current = true;
    setCfg((c) => (c ? { ...c, ...patch } : c));
  }
  const setSocial = (code: string, value: string) =>
    update({ socials: { ...(cfg?.socials ?? {}), [code]: value } });

  const adopt = (s: StorefrontState) => {
    touched.current = false;
    setCfg(s.config);
    setDirty(s.has_unpublished_changes);
    qc.setQueryData(["storefront"], s);
    qc.invalidateQueries({ queryKey: ["storefront-preview"] });
    qc.invalidateQueries({ queryKey: ["seller-dashboard"] });
  };

  const publish = useMutation({
    // Flush any pending edits first: publish must ship what's on screen, not
    // what the last debounce tick happened to save.
    mutationFn: async () => {
      clearTimeout(saveTimer.current);
      if (cfgRef.current && touched.current) {
        await saveDraft(payloadFrom(cfgRef.current));
      }
      return publishStorefront();
    },
    onSuccess: adopt,
    onError: (e) => setError(apiError(e, "Couldn't publish.")),
  });
  const unpublish = useMutation({
    mutationFn: unpublishStorefront,
    onSuccess: (s) => {
      adopt(s);
      setConfirmUnpublish(false);
    },
    onError: (e) => {
      setConfirmUnpublish(false);
      setError(apiError(e, "Couldn't unpublish — your store is still live."));
    },
  });
  const discard = useMutation({ mutationFn: discardDraft, onSuccess: adopt });
  const imgMut = useMutation({
    mutationFn: (f: { file: File; kind: "logo" | "cover" }) =>
      f.kind === "logo" ? uploadLogo(f.file) : uploadCover(f.file),
    onSuccess: (s) => {
      setCfg((c) => (c ? { ...c, logo_url: s.config.logo_url, cover_url: s.config.cover_url } : c));
      setDirty(true);
    },
    onError: (e) => setError(apiError(e, "Upload failed.")),
  });
  const imgDel = useMutation({
    mutationFn: (kind: "logo" | "cover") => (kind === "logo" ? removeLogo() : removeCover()),
    onSuccess: (s) => {
      setCfg((c) => (c ? { ...c, logo_url: s.config.logo_url, cover_url: s.config.cover_url } : c));
      setDirty(true);
    },
  });

  function pickFile(file: File | undefined, kind: "logo" | "cover") {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return setError("Image must be a JPG, PNG or WebP file.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Image is too large (max ${MAX_MB} MB).`);
    setError(null);
    imgMut.mutate({ file, kind });
  }

  const products = state?.products ?? [];

  // Ordered list for the curation panel (anything new falls to the end).
  const ordered = useMemo(() => {
    if (!cfg) return products;
    const order = cfg.curation.order;
    return [...products].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    });
  }, [cfg, products]);

  // Preview mirrors the public page's rules: featured first, then order, minus hidden.
  const previewProducts = useMemo(() => {
    if (!cfg) return [];
    const { hidden, featured } = cfg.curation;
    return ordered
      .filter((p) => !hidden.includes(p.id))
      .map((p) => ({ ...p, featured: featured.includes(p.id) }))
      .sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [cfg, ordered]);

  function move(id: string, dir: -1 | 1) {
    if (!cfg) return;
    const ids = ordered.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    update({ curation: { ...cfg.curation, order: ids } });
  }
  function toggle(id: string, key: "hidden" | "featured") {
    if (!cfg) return;
    const list = cfg.curation[key];
    update({
      curation: {
        ...cfg.curation,
        [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      },
    });
  }

  if (isLoading || !cfg || !state) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const host = window.location.host;
  const status = PUBLISH_STATUS[state.status];
  const liveUrl = absoluteStoreUrl(state.store_url);
  const check = state.slug_check;
  // Changing the URL of a LIVE store silently breaks every link to it. Only a
  // published store has a URL to move — for draft/unpublished there's nothing
  // to warn about (store_url is null there, which used to make this fire always).
  const liveSlug = state.store_url ? state.store_url.split("/").pop() : null;
  const slugMoving = state.status === "PUBLISHED" && !!state.pending_slug && !!liveSlug && state.pending_slug !== liveSlug;

  function copyUrl() {
    if (!liveUrl || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(liveUrl)
      .then(() => {
        setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => setError("Couldn't copy — select the URL and copy it manually."));
  }

  return (
    <div>
      <PageHeader
        title="Website builder"
        subtitle="Design your public brand page. Changes stay in draft until you publish."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>
              <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </Badge>
            {dirty && <Badge tone="amber">Unpublished changes</Badge>}
          </div>
        }
      />

      {/* ── Publishing status ────────────────────────────────────────────── */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", status.dot)} />
              <h2 className="font-semibold text-slate-900">Website is {status.label.toLowerCase()}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{status.hint}</p>

            {liveUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm text-slate-700">{liveUrl}</code>
                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" /> Visit
                  </Button>
                </a>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Your URL will be{" "}
                <span className="font-medium text-slate-600">
                  {host}/store/{state.pending_slug || "your-brand"}
                </span>
              </p>
            )}
          </div>

          {state.last_published_at && (
            <p className="text-xs text-slate-400">
              Last published {new Date(state.last_published_at).toLocaleString()}
            </p>
          )}
        </div>

        {state.blockers.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Before publishing: {state.blockers.join(" ")}</span>
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Editor ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Branding */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Branding</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ImageField
                label="Logo"
                hint="Square, 512×512 recommended"
                url={cfg.logo_url}
                shape="square"
                busy={imgMut.isPending}
                onPick={() => logoRef.current?.click()}
                onRemove={() => imgDel.mutate("logo")}
              />
              <ImageField
                label="Cover image"
                hint="Wide, 1600×600 recommended"
                url={cfg.cover_url}
                shape="wide"
                busy={imgMut.isPending}
                onPick={() => coverRef.current?.click()}
                onRemove={() => imgDel.mutate("cover")}
              />
            </div>
            <input ref={logoRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0], "logo")} />
            <input ref={coverRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pickFile(e.target.files?.[0], "cover")} />
            {!cfg.logo_url && <p className="mt-2 text-xs text-amber-600">A logo is recommended — stores with one look far more credible.</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Brand name</label>
                <input className="input" value={cfg.brand_name ?? ""} onChange={(e) => update({ brand_name: e.target.value })} placeholder="Aurora Studio" />
              </div>
              <div>
                <label className="label">Creator name</label>
                <input className="input" value={cfg.creator_name ?? ""} onChange={(e) => update({ creator_name: e.target.value })} placeholder="The name behind it" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Description</label>
                <span className={cn("text-xs", (cfg.description?.length ?? 0) > DESCRIPTION_MAX ? "text-red-500" : "text-slate-400")}>
                  {cfg.description?.length ?? 0}/{DESCRIPTION_MAX}
                </span>
              </div>
              <textarea
                className="input mt-1.5 min-h-24 resize-y"
                maxLength={DESCRIPTION_MAX}
                value={cfg.description ?? ""}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Tell customers what your brand is about."
              />
            </div>
          </Card>

          {/* Theme */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Theme</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => update({ theme: { ...cfg.theme, primary: p.primary, accent: p.accent } })}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                    cfg.theme.primary === p.primary ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className="flex">
                    <span className="h-4 w-4 rounded-l" style={{ background: p.primary }} />
                    <span className="h-4 w-4 rounded-r" style={{ background: p.accent }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ColorField label="Primary color" value={cfg.theme.primary} onChange={(v) => update({ theme: { ...cfg.theme, primary: v } })} />
              <ColorField label="Accent color" value={cfg.theme.accent} onChange={(v) => update({ theme: { ...cfg.theme, accent: v } })} />
            </div>

            <div className="mt-4">
              <label className="label">Button style</label>
              <div className="flex flex-wrap gap-2">
                {BUTTON_STYLES.map((b) => (
                  <button
                    key={b}
                    onClick={() => update({ theme: { ...cfg.theme, button_style: b } })}
                    className={cn(
                      "border px-4 py-1.5 text-sm font-medium capitalize transition",
                      b === "pill" ? "rounded-full" : b === "square" ? "rounded-none" : "rounded-lg",
                      cfg.theme.button_style === b ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Homepage curation */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Homepage products</h2>
            <p className="mb-3 text-sm text-slate-500">Reorder, feature or hide products on your storefront.</p>
            {ordered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                No live products yet. Publish a product and it'll appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {ordered.map((p, i) => {
                  const hidden = cfg.curation.hidden.includes(p.id);
                  const featured = cfg.curation.featured.includes(p.id);
                  return (
                    <li key={p.id} className={cn("flex items-center gap-3 rounded-lg border border-slate-200 p-2", hidden && "opacity-50")}>
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
                        {p.base_image_url && <img src={p.base_image_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">€{p.price}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconBtn title="Move up" disabled={i === 0} onClick={() => move(p.id, -1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Move down" disabled={i === ordered.length - 1} onClick={() => move(p.id, 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                        <IconBtn title={featured ? "Unfeature" : "Feature"} active={featured} onClick={() => toggle(p.id, "featured")}>
                          <Star className={cn("h-4 w-4", featured && "fill-current")} />
                        </IconBtn>
                        <IconBtn title={hidden ? "Show" : "Hide"} active={hidden} onClick={() => toggle(p.id, "hidden")}>
                          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </IconBtn>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Store info */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Store information</h2>
            <div className="mt-4">
              <label className="label">Store URL</label>
              <div
                className={cn(
                  "flex items-center rounded-lg border bg-slate-50 focus-within:ring-4",
                  check && !check.available
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
                    : "border-slate-300 focus-within:border-brand-500 focus-within:ring-brand-100",
                )}
              >
                <span className="whitespace-nowrap px-3 text-sm text-slate-400">{host}/store/</span>
                <input
                  className="w-full bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                  value={cfg.slug ?? ""}
                  onChange={(e) => update({ slug: e.target.value })}
                  placeholder="your-brand"
                />
                <span className="px-2.5">
                  {check ? (
                    check.available ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )
                  ) : null}
                </span>
              </div>

              {check && !check.available && (
                <p className="mt-1.5 text-xs text-red-600">
                  {check.reason}
                  {check.suggestion && (
                    <>
                      {" "}
                      <button
                        className="font-medium underline"
                        onClick={() => update({ slug: check.suggestion! })}
                      >
                        Use “{check.suggestion}”
                      </button>
                    </>
                  )}
                </p>
              )}
              {check?.available && check.slug !== (cfg.slug ?? "") && (
                <p className="mt-1.5 text-xs text-slate-400">Will publish as “{check.slug}”.</p>
              )}
              {slugMoving && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Publishing moves your store to the new address — links to the old one will stop working.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Contact email <span className="font-normal text-slate-400">(optional)</span></label>
                <input className="input" value={cfg.contact_email ?? ""} onChange={(e) => update({ contact_email: e.target.value })} placeholder="hello@yourbrand.com" />
              </div>
              <div>
                <label className="label">Location <span className="font-normal text-slate-400">(optional)</span></label>
                <input className="input" value={cfg.location ?? ""} onChange={(e) => update({ location: e.target.value })} placeholder="Berlin, Germany" />
              </div>
            </div>
          </Card>

          {/* Socials */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Social links</h2>
            <div className="mt-4 space-y-3">
              {SOCIALS.map((s) => (
                <div key={s.key} className="flex items-center rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                  <span className="flex h-9 w-10 items-center justify-center text-slate-400">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-r-lg px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    value={cfg.socials[s.code] ?? ""}
                    onChange={(e) => setSocial(s.code, e.target.value)}
                    placeholder={s.placeholder}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Live preview ───────────────────────────────────── */}
        <div>
          <div className="sticky top-20">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Live preview</p>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDevice(d)}
                    title={d}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition",
                      device === d ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className={cn("mx-auto transition-all", device === "mobile" ? "max-w-[390px]" : "max-w-none")}>
              <div className="max-h-[70vh] overflow-y-auto rounded-2xl">
                <StorefrontView
                  mobile={device === "mobile"}
                  data={{
                    brandName: cfg.brand_name ?? "",
                    creatorName: cfg.creator_name,
                    description: cfg.description,
                    logoUrl: cfg.logo_url,
                    coverUrl: cfg.cover_url,
                    contactEmail: cfg.contact_email,
                    location: cfg.location,
                    socials: cfg.socials,
                    theme: cfg.theme,
                    products: previewProducts,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Action bar */}
      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-card backdrop-blur">
        <p className="text-sm text-slate-500">
          {save.isPending ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
          ) : save.isError ? (
            <span className="text-red-600">Autosave failed — your latest edits aren't saved.</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600">
              <Check className="h-3.5 w-3.5" /> Draft saved · not published yet
            </span>
          ) : state.status === "PUBLISHED" ? (
            "Your storefront is live and up to date."
          ) : (
            status.hint
          )}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => discard.mutate()} disabled={discard.isPending}>
              <Undo2 className="h-4 w-4" /> Discard changes
            </Button>
          )}
          {state.status === "PUBLISHED" && (
            <Button variant="outline" onClick={() => setConfirmUnpublish(true)} disabled={unpublish.isPending}>
              Unpublish
            </Button>
          )}
          {/* Preview leaves the editor so the seller judges the page on its own,
              without the builder chrome next to it. */}
          <Button variant="outline" onClick={() => nav("/seller/storefront/preview")}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button
            onClick={() => publish.mutate()}
            disabled={publish.isPending || state.blockers.length > 0}
            title={state.blockers.join(" ")}
          >
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {state.status === "PUBLISHED" ? "Publish changes" : "Publish website"}
          </Button>
        </div>
      </div>

      {state.status === "PUBLISHED" && cfg.slug && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Live at{" "}
          <Link to={`/store/${cfg.slug}`} className="font-medium text-brand-600 hover:underline">
            {host}/store/{cfg.slug}
          </Link>
        </p>
      )}

      {confirmUnpublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-w-sm p-6">
            <h3 className="font-semibold text-slate-900">Take your website offline?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Customers visiting {liveUrl ?? "your store URL"} will see a “not found” page. Your content,
              design and products are kept — publish again any time to bring it back.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmUnpublish(false)}>
                Cancel
              </Button>
              <Button onClick={() => unpublish.mutate()} disabled={unpublish.isPending}>
                {unpublish.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Unpublish
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── small pieces ──────────────────────────────────────────────────────────────

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg p-1.5 transition",
        active ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
        disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // The text field holds whatever the seller is mid-typing; only a valid hex is
  // pushed into the theme. Without this, "#63" reaches the CSS variables and the
  // whole preview gradient/avatar goes invisible while typing.
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = text.trim() !== "" && !HEX_RE.test(text.trim());

  function onText(v: string) {
    setText(v);
    if (HEX_RE.test(v.trim())) onChange(v.trim());
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#6366f1"}
          onChange={(e) => onText(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <input
          className={cn("input font-mono text-xs", invalid && "border-red-300")}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={() => setText(value)}
          placeholder="#6366f1"
        />
      </div>
      {invalid && <p className="mt-1 text-xs text-red-600">Use a hex colour like #6366f1.</p>}
    </div>
  );
}

function ImageField({
  label,
  hint,
  url,
  shape,
  busy,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null;
  shape: "square" | "wide";
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50",
          shape === "square" ? "aspect-square max-w-32" : "aspect-[16/6]",
        )}
      >
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-6 w-6 text-slate-300" />}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPick} disabled={busy}>
          <Upload className="h-4 w-4" /> {url ? "Replace" : "Upload"}
        </Button>
        {url && (
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

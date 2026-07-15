import {
  Check,
  ExternalLink,
  Eye,
  ImageOff,
  Loader2,
  Pencil,
  Rocket,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  getStorefront,
  publishStorefront,
  removeCover,
  removeLogo,
  unpublishStorefront,
  updateStorefront,
  uploadCover,
  uploadLogo,
  type StorefrontState,
} from "../../../api/storefront";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StorefrontView } from "../../../components/storefront/StorefrontView";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";
import { SOCIALS } from "../../../lib/socials";

const DESCRIPTION_MAX = 500;
const MAX_MB = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Socials = Record<string, string>; // keyed by SocialDef.key (lowercase)

const emptySocials = (): Socials => Object.fromEntries(SOCIALS.map((s) => [s.key, ""]));

export default function SellerStorefront() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const [brandName, setBrandName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [socials, setSocials] = useState<Socials>(emptySocials());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  // Adopt every server-owned field from a fresh state response.
  function adopt(s: StorefrontState) {
    setBrandName(s.brand_name ?? "");
    setCreatorName(s.creator_name ?? "");
    setSlug(s.slug ?? "");
    setDescription(s.description ?? "");
    setLogoUrl(s.logo_url);
    setCoverUrl(s.cover_url);
    setIsPublished(s.is_published);
    const next = emptySocials();
    for (const def of SOCIALS) next[def.key] = s.socials[def.code] ?? "";
    setSocials(next);
  }

  useEffect(() => {
    getStorefront()
      .then(adopt)
      .catch(() => setError("Couldn't load your storefront."))
      .finally(() => setLoading(false));
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function persist(): Promise<StorefrontState> {
    const payload = {
      brand_name: brandName.trim(),
      creator_name: creatorName.trim(),
      description: description.trim(),
      slug: slug.trim() || undefined,
      socials: Object.fromEntries(SOCIALS.map((s) => [s.key, socials[s.key].trim()])),
    };
    const s = await updateStorefront(payload);
    adopt(s);
    return s;
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      await persist();
      flashSaved();
    } catch (e) {
      setError(apiError(e, "Couldn't save your changes."));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setError(null);
    setPublishing(true);
    try {
      await persist(); // save latest edits first, then flip live
      adopt(await publishStorefront());
    } catch (e) {
      setError(apiError(e, "Couldn't publish — check the required fields."));
    } finally {
      setPublishing(false);
    }
  }

  async function onUnpublish() {
    setError(null);
    setPublishing(true);
    try {
      adopt(await unpublishStorefront());
    } catch (e) {
      setError(apiError(e, "Couldn't unpublish."));
    } finally {
      setPublishing(false);
    }
  }

  const brandValid = brandName.trim().length > 0;
  const storeHost = window.location.host;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Storefront"
        subtitle="Customize your public brand page, then publish it for customers to visit."
        actions={
          <div className="flex items-center gap-2">
            {isPublished ? (
              <Badge tone="green">Live</Badge>
            ) : (
              <Badge tone="amber">Draft</Badge>
            )}
            {isPublished && slug && (
              <a href={`/store/${slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" /> View live
                </Button>
              </a>
            )}
          </div>
        }
      />

      {/* Edit / Preview toggle */}
      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {(["edit", "preview"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition",
              mode === m ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {m === "edit" ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {m}
          </button>
        ))}
      </div>

      {mode === "preview" ? (
        <div>
          <p className="mb-3 text-sm text-slate-500">This is exactly how customers will see your storefront.</p>
          <StorefrontView
            data={{
              brandName,
              creatorName,
              description,
              logoUrl,
              coverUrl,
              socials: Object.fromEntries(
                SOCIALS.filter((s) => socials[s.key].trim()).map((s) => {
                  const v = socials[s.key].trim();
                  return [s.code, /^https?:\/\//i.test(v) ? v : `https://${v}`];
                }),
              ),
            }}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Brand info */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Brand information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  Brand name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Aurora Studio"
                />
              </div>
              <div>
                <label className="label">
                  Creator name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  className="input"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="The name behind the brand"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Store URL</label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="whitespace-nowrap px-3 text-sm text-slate-400">{storeHost}/store/</span>
                <input
                  className="w-full rounded-r-lg bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="your-brand"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Auto-generated from your brand name. Must be unique.</p>
            </div>
          </Card>

          {/* Images */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Logo & cover</h2>
            <p className="mb-4 text-sm text-slate-500">JPG, PNG or WebP · up to {MAX_MB} MB. Images are optimized automatically.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <ImagePicker
                label="Logo"
                shape="square"
                url={logoUrl}
                onUpload={uploadLogo}
                onRemove={removeLogo}
                onDone={adopt}
                onError={setError}
              />
              <ImagePicker
                label="Cover image"
                shape="wide"
                url={coverUrl}
                onUpload={uploadCover}
                onRemove={removeCover}
                onDone={adopt}
                onError={setError}
              />
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Description</h2>
              <span className={cn("text-xs", description.length > DESCRIPTION_MAX ? "text-red-500" : "text-slate-400")}>
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <textarea
              className="input mt-3 min-h-28 resize-y"
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers what your brand is about."
            />
          </Card>

          {/* Socials */}
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900">Social links</h2>
            <p className="mb-4 text-sm text-slate-500">Optional — add the channels where fans can find you.</p>
            <div className="space-y-3">
              {SOCIALS.map((s) => (
                <div key={s.key} className="flex items-center rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                  <span className="flex h-9 w-10 items-center justify-center text-slate-400">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <input
                    className="w-full rounded-r-lg px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    value={socials[s.key]}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    placeholder={s.placeholder}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Action bar */}
      <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-card backdrop-blur">
        <p className="text-sm text-slate-500">
          {isPublished ? "Your storefront is live." : "Draft — not visible to customers yet."}
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          <Button variant="outline" onClick={onSave} disabled={saving || publishing}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
          </Button>
          {isPublished ? (
            <Button variant="ghost" onClick={onUnpublish} disabled={publishing || saving}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Unpublish
            </Button>
          ) : (
            <Button onClick={onPublish} disabled={publishing || saving || !brandValid} title={brandValid ? "" : "Add a brand name first"}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
            </Button>
          )}
        </div>
      </div>
      {isPublished && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Live at{" "}
          <Link to={`/store/${slug}`} className="font-medium text-brand-600 hover:underline">
            {storeHost}/store/{slug}
          </Link>
        </p>
      )}
    </div>
  );
}

// ── image picker ───────────────────────────────────────────────────────────────

function ImagePicker({
  label,
  shape,
  url,
  onUpload,
  onRemove,
  onDone,
  onError,
}: {
  label: string;
  shape: "square" | "wide";
  url: string | null;
  onUpload: (file: File) => Promise<StorefrontState>;
  onRemove: () => Promise<StorefrontState>;
  onDone: (s: StorefrontState) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      onError("Image must be a JPG, PNG or WebP file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      onError(`Image is too large (max ${MAX_MB} MB).`);
      return;
    }
    setBusy(true);
    try {
      onDone(await onUpload(file));
    } catch (e) {
      onError(apiError(e, "Upload failed."));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemoveClick() {
    setBusy(true);
    try {
      onDone(await onRemove());
    } catch (e) {
      onError(apiError(e, "Couldn't remove image."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50",
          shape === "square" ? "aspect-square max-w-40" : "aspect-[16/6]",
        )}
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-slate-300">
            <ImageOff className="h-6 w-6" />
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" /> {url ? "Replace" : "Upload"}
        </Button>
        {url && (
          <Button variant="ghost" size="sm" onClick={onRemoveClick} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

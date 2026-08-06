import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImagePlus,
  Images,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import {
  addProjectImage,
  createProject,
  deleteProject,
  deleteProjectImage,
  getProjects,
  reorderProjectImages,
  setProjectPublished,
  updateProject,
  getOnboardingOptions,
  type DesignerProject,
} from "../../../api/designer";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { apiError } from "../../../lib/apiError";
import { cn } from "../../../lib/cn";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function DesignerPortfolio() {
  const [editing, setEditing] = useState<DesignerProject | "new" | null>(null);
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["my-projects"], queryFn: getProjects });

  return (
    <div>
      <PageHeader
        title="Portfolio"
        subtitle="Showcase your best work — sellers browse this before hiring."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add project
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No projects yet"
          hint="Add your first project — upload images, describe it, then publish it for sellers to see."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing && <ProjectEditor initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProjectCard({ project: p, onEdit }: { project: DesignerProject; onEdit: () => void }) {
  return (
    <Card className="group overflow-hidden">
      <button onClick={onEdit} className="block w-full text-left">
        <div className="relative aspect-[4/3] bg-slate-100">
          {p.cover_url ? (
            <img src={p.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
            {p.featured && (
              <Badge tone="amber" className="gap-1">
                <Star className="h-3 w-3 fill-current" /> Featured
              </Badge>
            )}
            <Badge tone={p.published ? "green" : "slate"}>{p.published ? "Published" : "Draft"}</Badge>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold text-slate-900">{p.title}</h3>
            <Pencil className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{fmtDate(p.created_at)}</p>
          {p.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.categories.map((c) => (
                <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
    </Card>
  );
}

function ProjectEditor({ initial, onClose }: { initial: DesignerProject | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: opts } = useQuery({ queryKey: ["onboarding-options"], queryFn: getOnboardingOptions });
  const categoryOptions = opts?.skills ?? [];

  // Live project (null until created). Fields mirror the editor form.
  const [project, setProject] = useState<DesignerProject | null>(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = (p: DesignerProject) => {
    setProject(p);
    qc.invalidateQueries({ queryKey: ["my-projects"] });
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), description: description.trim() || null, categories };
      if (project) return updateProject(project.id, body);
      return createProject({ title: body.title, description: body.description, categories });
    },
    onSuccess: refresh,
    onError: (e) => setError(apiError(e, "Could not save the project.")),
  });

  const publish = useMutation({
    mutationFn: (next: boolean) => setProjectPublished(project!.id, next),
    onSuccess: refresh,
    onError: (e) => setError(apiError(e, "Could not change visibility.")),
  });

  const feature = useMutation({
    mutationFn: (next: boolean) => updateProject(project!.id, { featured: next }),
    onSuccess: refresh,
  });

  const removeImage = useMutation({
    mutationFn: (imageId: string) => deleteProjectImage(project!.id, imageId),
    onSuccess: refresh,
  });

  const makeCover = useMutation({
    mutationFn: (imageId: string) => {
      const rest = project!.images.filter((i) => i.id !== imageId).map((i) => i.id);
      return reorderProjectImages(project!.id, [imageId, ...rest]);
    },
    onSuccess: refresh,
  });

  const removeProject = useMutation({
    mutationFn: () => deleteProject(project!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      onClose();
    },
  });

  async function uploadFiles(files: FileList | File[]) {
    if (!project) {
      setError("Save the project first, then add images.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      let latest = project;
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        latest = await addProjectImage(project.id, f);
      }
      refresh(latest);
    } catch (e) {
      setError(apiError(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  const toggleCategory = (c: string) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const canPublish = !!project && project.images.length > 0;
  const dirtyMeta =
    !project ||
    title.trim() !== project.title ||
    (description.trim() || "") !== (project.description ?? "") ||
    JSON.stringify(categories) !== JSON.stringify(project.categories);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
      <Card className="w-full max-w-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{project ? "Edit project" : "New project"}</h2>
          <div className="flex items-center gap-2">
            {project?.published && <Badge tone="green">Published</Badge>}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Streetwear capsule for Nova"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What was the brief, your approach, the result?"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    categories.includes(c)
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => saveMeta.mutate()} disabled={!title.trim() || saveMeta.isPending || !dirtyMeta}>
            {saveMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {project ? "Save details" : "Create project"}
          </Button>

          {/* Images — only once the project exists */}
          {project && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Images <span className="font-normal text-slate-400">· first is the cover</span>
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  uploadFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-6 text-sm transition",
                  dragging ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-500 hover:border-slate-400",
                )}
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span>{uploading ? "Uploading…" : "Drag & drop images, or click to browse"}</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                />
              </div>

              {project.images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {project.images.map((img, idx) => (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-slate-900/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                        {idx !== 0 ? (
                          <button
                            onClick={() => makeCover.mutate(img.id)}
                            title="Make cover"
                            className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white"
                          >
                            Cover
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          onClick={() => removeImage.mutate(img.id)}
                          title="Remove image"
                          className="rounded bg-white/90 p-1 text-red-600 hover:bg-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {project && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => feature.mutate(!project.featured)}>
                <Star className={cn("h-4 w-4", project.featured && "fill-amber-400 text-amber-400")} />
                {project.featured ? "Featured" : "Feature"}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeProject.mutate()}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
            {project.published ? (
              <Button variant="outline" size="sm" onClick={() => publish.mutate(false)} disabled={publish.isPending}>
                Unpublish
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => publish.mutate(true)}
                disabled={!canPublish || publish.isPending}
                title={canPublish ? undefined : "Add at least one image first"}
              >
                {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publish
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

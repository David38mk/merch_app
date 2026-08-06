import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Globe,
  ImageIcon,
  ImagePlus,
  Instagram,
  Loader2,
  MessagesSquare,
  Palette,
  Sparkles,
  Star,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addPortfolioImage,
  completeOnboarding,
  getDesignerOnboarding,
  getOnboardingOptions,
  patchDesignerProfile,
  removePortfolioImage,
  uploadDesignerAvatar,
  uploadDesignerCover,
} from "../../api/designer";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { apiError } from "../../lib/apiError";
import { cn } from "../../lib/cn";

const STEPS = ["Welcome", "Profile", "Skills", "Portfolio", "Finish"] as const;

export default function DesignerOnboarding() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: ob, isLoading } = useQuery({ queryKey: ["designer-onboarding"], queryFn: getDesignerOnboarding });
  const { data: options } = useQuery({ queryKey: ["onboarding-options"], queryFn: getOnboardingOptions });

  // Local form state, seeded once the profile loads.
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState<string | null>(null);
  const [contact, setContact] = useState({ website: "", behance: "", dribbble: "", instagram: "" });
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (ob && !seeded) {
      setDisplayName(ob.display_name ?? "");
      setBio(ob.bio ?? "");
      setCountry(ob.country ?? "");
      setSkills(ob.skills ?? []);
      setExperience(ob.experience ?? null);
      setContact({
        website: ob.website ?? "",
        behance: ob.behance ?? "",
        dribbble: ob.dribbble ?? "",
        instagram: ob.instagram ?? "",
      });
      setSeeded(true);
    }
  }, [ob, seeded]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["designer-onboarding"] });

  const patch = useMutation({ mutationFn: patchDesignerProfile, onSuccess: () => refresh() });
  const avatar = useMutation({ mutationFn: uploadDesignerAvatar, onSuccess: () => refresh() });
  const cover = useMutation({ mutationFn: uploadDesignerCover, onSuccess: () => refresh() });
  const addImg = useMutation({ mutationFn: addPortfolioImage, onSuccess: () => refresh() });
  const rmImg = useMutation({ mutationFn: removePortfolioImage, onSuccess: () => refresh() });
  const finish = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => navigate("/designer", { replace: true }),
    onError: (e) => setError(apiError(e, "Couldn't finish onboarding.")),
  });

  const toggleSkill = (s: string) =>
    setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function next() {
    setError(null);
    try {
      if (step === 1) {
        if (!displayName.trim()) return setError("Please add a display name.");
        await patch.mutateAsync({ display_name: displayName.trim(), bio, country, ...contact });
      } else if (step === 2) {
        await patch.mutateAsync({ skills, experience });
      }
      // Step 3 (Portfolio): images upload immediately — nothing to patch.
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch (e) {
      setError(apiError(e, "Couldn't save — please try again."));
    }
  }

  if (isLoading || !ob) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const busy = patch.isPending || finish.isPending;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Brand />
          <button onClick={() => navigate("/designer")} className="text-sm text-slate-400 hover:text-slate-600">
            Skip for now
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="mx-auto mt-6 max-w-2xl px-6">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                <div className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-500" : "bg-slate-200")} />
              </div>
              <span className={cn("text-[11px] font-medium", i <= step ? "text-brand-700" : "text-slate-400")}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          {step === 0 && <Welcome />}

          {step === 1 && (
            <Step title="Your profile" subtitle="This is how brands will see you.">
              {/* Cover */}
              <div className="relative h-28 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-brand-100 to-brand-50">
                {ob.cover_url && <img src={ob.cover_url} alt="" className="h-full w-full object-cover" />}
                <label className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-white">
                  {cover.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  Cover
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && cover.mutate(e.target.files[0])} />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {ob.avatar_url ? (
                    <img src={ob.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Palette className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {avatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])}
                  />
                </label>
              </div>
              <Field label="Display name">
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Bio">
                <textarea
                  className="input min-h-[90px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell brands about your style and what you love to design."
                />
              </Field>
              <Field label="Country">
                <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Croatia" />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Contact & links</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ContactInput icon={Globe} placeholder="Website" value={contact.website} onChange={(v) => setContact((c) => ({ ...c, website: v }))} />
                  <ContactInput label="Be" placeholder="Behance" value={contact.behance} onChange={(v) => setContact((c) => ({ ...c, behance: v }))} />
                  <ContactInput label="Dr" placeholder="Dribbble" value={contact.dribbble} onChange={(v) => setContact((c) => ({ ...c, dribbble: v }))} />
                  <ContactInput icon={Instagram} placeholder="Instagram" value={contact.instagram} onChange={(v) => setContact((c) => ({ ...c, instagram: v }))} />
                </div>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title="Your skills" subtitle="Pick the categories you work in — we'll match you to relevant opportunities.">
              <div className="flex flex-wrap gap-2">
                {(options?.skills ?? []).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSkill(s)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      skills.includes(s)
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-slate-700">Experience level</p>
                <div className="grid grid-cols-3 gap-2">
                  {(options?.experience ?? []).map((x) => (
                    <button
                      key={x}
                      onClick={() => setExperience(x)}
                      className={cn(
                        "rounded-lg border p-3 text-sm font-medium transition",
                        experience === x
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="Your portfolio" subtitle="Show your best work. You can always add more later.">
              <div className="flex flex-wrap gap-2">
                {ob.portfolio_items.map((it) => (
                  <div key={it.id} className="relative h-24 w-24">
                    <img src={it.image_url} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                    <button
                      onClick={() => rmImg.mutate(it.id)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-400">
                  {addImg.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-[11px]">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      Array.from(e.target.files ?? []).forEach((f) => addImg.mutate(f));
                    }}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-400">Add your best pieces, or skip and add them later.</p>
            </Step>
          )}

          {step === 4 && (
            <Step title="You're all set 🎉" subtitle="Your designer profile is ready. Here's what happens next.">
              <ul className="space-y-3">
                <Next2 icon={MessagesSquare}>Browse open design calls from brands and apply.</Next2>
                <Next2 icon={Award}>Collaborate on paid projects through the workspace.</Next2>
                <Next2 icon={Star}>Earn reviews and build your public reputation.</Next2>
              </ul>
              <p className="mt-4 text-xs text-slate-400">You can edit any of this later from your designer profile.</p>
            </Step>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {/* Nav */}
          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {step === 0 ? "Get started" : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
                {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Go to dashboard
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Welcome() {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Sparkles className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Welcome to the Designer Platform</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        MyHappinessClub connects designers with brands who need original work. Let's set up your profile so we can
        recommend the right opportunities.
      </p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        <Perk icon={MessagesSquare} title="Find work">Apply to paid design calls from brands.</Perk>
        <Perk icon={Trophy} title="Get paid">Collaborate and earn on every accepted project.</Perk>
        <Perk icon={Star} title="Build reputation">Grow a public portfolio and reviews.</Perk>
      </div>
    </div>
  );
}

function Perk({ icon: Icon, title, children }: { icon: typeof Star; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <Icon className="h-5 w-5 text-brand-600" />
      <p className="mt-1.5 text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500">{children}</p>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function ContactInput({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon?: typeof Globe;
  label?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[10px] font-bold text-slate-400">
        {Icon ? <Icon className="h-4 w-4" /> : label}
      </span>
      <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Next2({ icon: Icon, children }: { icon: typeof Star; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm text-slate-700">{children}</span>
    </li>
  );
}

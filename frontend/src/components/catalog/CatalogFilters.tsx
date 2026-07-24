import type { ReactNode } from "react";

import type { Facets } from "../../api/catalog";
import { cn } from "../../lib/cn";
import { colorHex, isLightColor } from "../../lib/colorHex";

export interface CatalogFilterValue {
  category_id?: string;
  provider_id?: string;
  color?: string;
  material?: string;
  print_method?: string;
  min_price?: number;
  max_price?: number;
  available_only: boolean;
  favorites_only: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-4">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

export function CatalogFilters({
  facets,
  value,
  onChange,
  onClear,
}: {
  facets: Facets;
  value: CatalogFilterValue;
  onChange: (patch: Partial<CatalogFilterValue>) => void;
  onClear: () => void;
}) {
  // single-select toggle: clicking the active value clears it
  const pick = <K extends keyof CatalogFilterValue>(key: K, v: CatalogFilterValue[K]) =>
    onChange({ [key]: value[key] === v ? undefined : v } as Partial<CatalogFilterValue>);

  const hasActive =
    value.category_id ||
    value.provider_id ||
    value.color ||
    value.material ||
    value.print_method ||
    value.min_price !== undefined ||
    value.max_price !== undefined ||
    value.available_only ||
    value.favorites_only;

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between pb-1">
        <p className="font-semibold text-slate-900">Filters</p>
        {hasActive && (
          <button onClick={onClear} className="text-xs font-medium text-brand-600 hover:underline">
            Clear all
          </button>
        )}
      </div>

      <Section title="Category">
        <div className="flex flex-wrap gap-1.5">
          {facets.categories.map((c) => (
            <Chip key={c.id} active={value.category_id === c.id} onClick={() => pick("category_id", c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Print provider">
        <div className="flex flex-wrap gap-1.5">
          {facets.providers.map((p) => (
            <Chip key={p.id} active={value.provider_id === p.id} onClick={() => pick("provider_id", p.id)}>
              {p.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Color">
        <div className="flex flex-wrap gap-2">
          {facets.colors.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => pick("color", c)}
              className={cn(
                "h-7 w-7 rounded-full ring-2 ring-offset-2 transition",
                value.color === c ? "ring-brand-500" : "ring-transparent",
                isLightColor(c) && "border border-slate-200",
              )}
              style={{ backgroundColor: colorHex(c) }}
            />
          ))}
        </div>
      </Section>

      <Section title="Material">
        <div className="flex flex-wrap gap-1.5">
          {facets.materials.map((m) => (
            <Chip key={m} active={value.material === m} onClick={() => pick("material", m)}>
              {m}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Print method">
        <div className="flex flex-wrap gap-1.5">
          {facets.print_methods.map((m) => (
            <Chip key={m} active={value.print_method === m} onClick={() => pick("print_method", m)}>
              {m}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Base price (€)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input py-1.5"
            placeholder={String(Math.floor(facets.price_min))}
            value={value.min_price ?? ""}
            min={0}
            onChange={(e) => onChange({ min_price: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            className="input py-1.5"
            placeholder={String(Math.ceil(facets.price_max))}
            value={value.max_price ?? ""}
            min={0}
            onChange={(e) => onChange({ max_price: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </Section>

      <Section title="More">
        <label className="flex items-center gap-2 py-1 text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={value.available_only}
            onChange={(e) => onChange({ available_only: e.target.checked })}
          />
          In stock only
        </label>
        <label className="flex items-center gap-2 py-1 text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={value.favorites_only}
            onChange={(e) => onChange({ favorites_only: e.target.checked })}
          />
          My favorites
        </label>
      </Section>
    </div>
  );
}

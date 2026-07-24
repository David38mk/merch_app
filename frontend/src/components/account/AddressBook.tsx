import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
  type Address,
  type AddressInput,
  type AddressType,
} from "../../api/account";
import { apiError } from "../../lib/apiError";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const EMPTY: AddressInput = {
  address_type: "SHIPPING",
  is_default: false,
  use_for_both: false,
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
};

export function AddressBook() {
  const qc = useQueryClient();
  const { data: addresses, isLoading } = useQuery({ queryKey: ["addresses"], queryFn: getAddresses });
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adopt = (rows: Address[]) => {
    qc.setQueryData(["addresses"], rows);
    setEditing(null);
    setError(null);
  };
  const onError = (e: unknown) => setError(apiError(e, "Couldn't save that address."));

  const del = useMutation({ mutationFn: deleteAddress, onSuccess: adopt, onError });
  const setDefault = useMutation({
    mutationFn: (a: Address) => updateAddress(a.id, { is_default: true }),
    onSuccess: adopt,
    onError,
  });

  const shipping = (addresses ?? []).filter((a) => a.address_type === "SHIPPING");
  const billing = (addresses ?? []).filter((a) => a.address_type === "BILLING");

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <MapPin className="h-4 w-4 text-slate-400" /> Saved addresses
        </h2>
        <Button size="sm" variant="outline" onClick={() => { setEditing("new"); setError(null); }}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <div className="flex h-20 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !addresses || addresses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No saved addresses yet. Add one to check out faster next time.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Group title="Shipping" rows={shipping} onEdit={setEditing} onDelete={(a) => del.mutate(a.id)} onDefault={(a) => setDefault.mutate(a)} />
          <Group title="Billing" rows={billing} onEdit={setEditing} onDelete={(a) => del.mutate(a.id)} onDefault={(a) => setDefault.mutate(a)} />
        </div>
      )}

      {editing && (
        <AddressForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={adopt}
          onError={onError}
        />
      )}
    </Card>
  );
}

function Group({
  title,
  rows,
  onEdit,
  onDelete,
  onDefault,
}: {
  title: string;
  rows: Address[];
  onEdit: (a: Address) => void;
  onDelete: (a: Address) => void;
  onDefault: (a: Address) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">None</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-2 font-medium text-slate-800">
                    {a.full_name}
                    {a.is_default && <Badge tone="brand">Default</Badge>}
                  </p>
                  <p className="text-slate-500">
                    {[a.line1, a.line2, a.city, a.region, a.postal_code, a.country].filter(Boolean).join(", ")}
                  </p>
                  {a.phone && <p className="text-slate-400">{a.phone}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!a.is_default && (
                    <button
                      title="Set as default"
                      onClick={() => onDefault(a)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    title="Edit"
                    onClick={() => onEdit(a)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => onDelete(a)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddressForm({
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  initial: Address | null;
  onCancel: () => void;
  onSaved: (rows: Address[]) => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState<AddressInput>(
    initial
      ? { ...EMPTY, ...initial, phone: initial.phone ?? "", line2: initial.line2 ?? "", region: initial.region ?? "" }
      : EMPTY,
  );
  const set = (k: keyof AddressInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () =>
      initial ? updateAddress(initial.id, form) : createAddress(form),
    onSuccess: onSaved,
    onError,
  });

  const valid = form.full_name.trim() && form.line1.trim() && form.city.trim() && form.postal_code.trim() && form.country.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h3 className="font-semibold text-slate-900">{initial ? "Edit address" : "Add address"}</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.address_type}
              onChange={(e) => set("address_type", e.target.value as AddressType)}
            >
              <option value="SHIPPING">Shipping</option>
              <option value="BILLING">Billing</option>
            </select>
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
        </div>

        <div className="mt-3">
          <label className="label">Address line 1</label>
          <input className="input" value={form.line1} onChange={(e) => set("line1", e.target.value)} />
        </div>
        <div className="mt-3">
          <label className="label">Address line 2 <span className="font-normal text-slate-400">(optional)</span></label>
          <input className="input" value={form.line2} onChange={(e) => set("line2", e.target.value)} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">City</label>
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className="label">State / region <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input" value={form.region} onChange={(e) => set("region", e.target.value)} />
          </div>
          <div>
            <label className="label">Postal code</label>
            <input className="input" value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Phone <span className="font-normal text-slate-400">(optional)</span></label>
          <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={form.is_default}
              onChange={(e) => set("is_default", e.target.checked)}
            />
            Set as my default {form.address_type === "SHIPPING" ? "shipping" : "billing"} address
          </label>
          {!initial && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={form.use_for_both}
                onChange={(e) => set("use_for_both", e.target.checked)}
              />
              Use this for both shipping and billing
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {initial ? "Save" : "Add address"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

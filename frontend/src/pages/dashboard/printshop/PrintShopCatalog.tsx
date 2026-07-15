import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Package, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { createBaseItem, listBaseItems } from "../../../api/catalog";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function PrintShopCatalog() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["base-items"], queryFn: listBaseItems });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createBaseItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base-items"] });
      setName("");
      setDescription("");
      setPrice("");
      setOpen(false);
    },
    onError: () => setError("Could not add the blank. Make sure you're signed in as a print shop."),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate({ name, description: description || undefined, base_price: Number(price) || 0 });
  }

  return (
    <div>
      <PageHeader
        title="Catalog"
        subtitle="The blank products sellers design on. You own these."
        actions={
          <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "primary"}>
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {open ? "Cancel" : "Add blank"}
          </Button>
        }
      />

      {open && (
        <Card className="mb-6 p-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Classic Tee" required />
            </div>
            <div>
              <label className="label">Base price (€)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="12.00"
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="180gsm cotton"
              />
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Adding…" : "Add to catalog"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {isError && (
        <Card className="p-6">
          <p className="text-sm text-red-600">Could not reach the API — is the backend running on :8001?</p>
        </Card>
      )}
      {data && data.length === 0 && (
        <Card className="p-6">
          <EmptyState
            icon={Boxes}
            title="No blanks in your catalog"
            hint="Add your first blank — it becomes available for sellers to design on and shows on the landing page."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Add blank
              </Button>
            }
          />
        </Card>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Package className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{b.name}</p>
                  {b.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{b.description}</p>}
                  <p className="mt-1.5 text-sm font-semibold text-brand-700">€{String(b.base_price)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

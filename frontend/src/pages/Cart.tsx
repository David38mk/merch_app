import { useMutation } from "@tanstack/react-query";
import { Loader2, Minus, Plus, ShoppingBag, Store, Tag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { validateDiscount } from "../api/marketplace";
import { CheckoutModal } from "../components/cart/CheckoutModal";
import { DesignPreviewThumb } from "../components/design/DesignPreviewThumb";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { lineKey, useCart, type CartItem } from "../cart";
import { apiError } from "../lib/apiError";
import { computeTotals } from "../lib/cartTotals";

export default function Cart() {
  const { byBrand, count } = useCart();

  if (count === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Card className="p-6">
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            hint="Browse the marketplace and add something you love."
            action={
              <Link to="/marketplace">
                <Button size="sm">Browse products</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your cart</h1>
        <Link to="/marketplace" className="text-sm font-medium text-brand-700 hover:underline">
          Continue shopping →
        </Link>
      </div>

      <div className="space-y-6">
        {byBrand.map((g) => (
          <BrandGroup key={g.slug} slug={g.slug} name={g.name} items={g.items} />
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Orders are placed per brand, since each creator's items ship from their own print partner.
      </p>
    </div>
  );
}

interface Applied {
  code: string;
  amount: number;
}

function BrandGroup({ slug, name, items }: { slug: string; name: string; items: CartItem[] }) {
  const { setQty, remove, clearBrand } = useCart();
  const [checkout, setCheckout] = useState(false);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const subtotal = useMemo(() => items.reduce((s, i) => s + Number(i.price) * i.quantity, 0), [items]);
  const totals = computeTotals(subtotal, applied?.amount ?? 0);

  const apply = useMutation({
    mutationFn: () => validateDiscount(code.trim(), slug, subtotal),
    onSuccess: (r) => {
      if (r.valid) {
        setApplied({ code: code.trim().toUpperCase(), amount: Number(r.amount) });
        setDiscountError(null);
      } else {
        setApplied(null);
        setDiscountError(r.message ?? "That code isn't valid.");
      }
    },
    onError: (e) => setDiscountError(apiError(e, "Couldn't check that code.")),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <Link
          to={`/store/${slug}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:underline"
        >
          <Store className="h-4 w-4 text-slate-400" /> {name}
        </Link>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((i) => {
          const key = lineKey(i);
          return (
            <li key={key} className="flex items-center gap-4 px-5 py-4">
              <Link to={`/p/${i.shop_item_id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                <DesignPreviewThumb
                  baseImageUrl={i.base_image_url}
                  designUrl={i.design_url}
                  pos_x={i.pos_x}
                  pos_y={i.pos_y}
                  scale={i.scale}
                  rotation={i.rotation}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/p/${i.shop_item_id}`} className="truncate font-medium text-slate-900 hover:underline">
                  {i.name}
                </Link>
                <p className="text-sm text-slate-500">{[i.color, i.size].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-slate-400">€{Number(i.price).toFixed(2)} each</p>
                <div className="mt-1.5 inline-flex items-center rounded-lg border border-slate-200">
                  <button className="px-2 py-1 text-slate-500 hover:text-slate-800" onClick={() => setQty(key, i.quantity - 1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-8 text-center text-sm">{i.quantity}</span>
                  <button className="px-2 py-1 text-slate-500 hover:text-slate-800" onClick={() => setQty(key, i.quantity + 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">€{(Number(i.price) * i.quantity).toFixed(2)}</p>
                <button
                  onClick={() => remove(key)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Discount code */}
      <div className="border-t border-slate-100 px-5 py-4">
        {applied ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <Tag className="h-4 w-4" /> {applied.code} applied
            </span>
            <button
              onClick={() => {
                setApplied(null);
                setCode("");
              }}
              className="text-emerald-700 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Discount code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setDiscountError(null);
              }}
            />
            <Button variant="outline" onClick={() => code.trim() && apply.mutate()} disabled={apply.isPending || !code.trim()}>
              {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
        {discountError && <p className="mt-2 text-sm text-red-600">{discountError}</p>}
      </div>

      {/* Order summary */}
      <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-sm">
        <Row label="Subtotal" value={`€${totals.subtotal.toFixed(2)}`} />
        {totals.discount > 0 && <Row label={`Discount${applied ? ` (${applied.code})` : ""}`} value={`− €${totals.discount.toFixed(2)}`} accent />}
        <Row label="Shipping" value={totals.shipping === 0 ? "Free" : `€${totals.shipping.toFixed(2)}`} />
        {totals.tax > 0 && <Row label="Tax" value={`€${totals.tax.toFixed(2)}`} />}
        <div className="mt-1 border-t border-slate-100 pt-2">
          <Row label="Total" value={`€${totals.total.toFixed(2)}`} strong />
        </div>
      </dl>

      <div className="px-5 pb-5">
        <Button className="w-full" onClick={() => setCheckout(true)}>
          Checkout · €{totals.total.toFixed(2)}
        </Button>
      </div>

      {checkout && (
        <CheckoutModal
          slug={slug}
          brandName={name}
          items={items}
          discountCode={applied?.code ?? null}
          discountAmount={applied?.amount ?? 0}
          onClose={() => setCheckout(false)}
          onDone={() => {
            clearBrand(slug);
            setCheckout(false);
          }}
        />
      )}
    </Card>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</dt>
      <dd className={strong ? "font-semibold text-slate-900" : accent ? "text-emerald-600" : "text-slate-700"}>{value}</dd>
    </div>
  );
}

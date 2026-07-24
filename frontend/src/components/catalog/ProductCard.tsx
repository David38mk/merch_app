import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Package } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { favoriteItem, unfavoriteItem, type BaseItemCard } from "../../api/catalog";
import { cn } from "../../lib/cn";
import { colorHex, isLightColor } from "../../lib/colorHex";

export function ProductCard({ item }: { item: BaseItemCard }) {
  const qc = useQueryClient();
  const [fav, setFav] = useState(item.is_favorite);

  const toggle = useMutation({
    mutationFn: () => (fav ? unfavoriteItem(item.id) : favoriteItem(item.id)),
    onMutate: () => setFav((f) => !f),
    onError: () => setFav((f) => !f), // revert on failure
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog"] }),
  });

  const extraColors = item.colors.length - 5;

  return (
    <Link
      to={`/seller/catalog/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-pop"
    >
      <div className="relative aspect-square bg-slate-100">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Package className="h-10 w-10" />
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            toggle.mutate();
          }}
          title={fav ? "Remove from favorites" : "Save to favorites"}
          aria-label={fav ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm transition hover:text-brand-600"
        >
          <Heart className={cn("h-4 w-4", fav && "fill-brand-500 text-brand-500")} />
        </button>

        {!item.available && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="truncate font-medium text-slate-900">{item.name}</p>
        <p className="mt-0.5 text-xs text-slate-400">{item.provider}</p>

        {item.colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {item.colors.slice(0, 5).map((c) => (
              <span
                key={c}
                title={c}
                className={cn("h-3.5 w-3.5 rounded-full", isLightColor(c) && "ring-1 ring-slate-200")}
                style={{ backgroundColor: colorHex(c) }}
              />
            ))}
            {extraColors > 0 && <span className="text-xs text-slate-400">+{extraColors}</span>}
          </div>
        )}

        <div className="mt-3 flex items-end justify-between">
          <p className="text-sm font-semibold text-brand-700">from €{item.base_price}</p>
          {item.print_areas.length > 0 && (
            <p className="text-[11px] text-slate-400">{item.print_areas.length} print area{item.print_areas.length > 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

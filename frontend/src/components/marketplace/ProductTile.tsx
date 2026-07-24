import { Link } from "react-router-dom";

import type { ProductCard } from "../../api/marketplace";
import { DesignPreviewThumb } from "../design/DesignPreviewThumb";
import { Card } from "../ui/Card";

/** A marketplace product card. Clicking it opens the Product Details Page. */
export function ProductTile({ p }: { p: ProductCard }) {
  return (
    <Link to={`/p/${p.id}`} className="group block">
      <Card className="overflow-hidden transition hover:shadow-pop">
        <DesignPreviewThumb
          baseImageUrl={p.base_image_url}
          designUrl={p.design_url}
          pos_x={p.pos_x}
          pos_y={p.pos_y}
          scale={p.scale}
          rotation={p.rotation}
        />
        <div className="p-3">
          <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
          <p className="truncate text-xs text-slate-400">{p.store_name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">€{p.price}</p>
        </div>
      </Card>
    </Link>
  );
}

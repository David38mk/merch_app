"use client";

import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, Package } from "lucide-react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
    description: string | null;
    category: string | null;
  };
  sellerId: string;
  sellerSlug: string;
}

export default function ProductCard({ product, sellerId, sellerSlug }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      sellerId,
      sellerSlug,
    });
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {product.category && (
          <span className="absolute top-2 left-2 rounded-full bg-white/90 text-xs px-2 py-0.5 font-medium">
            {product.category}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold truncate">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold">{formatCurrency(product.price)}</span>
          <Button size="sm" onClick={handleAdd}>
            <ShoppingCart className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

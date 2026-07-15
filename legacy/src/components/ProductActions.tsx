"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";

interface Product {
  id: string;
  name: string;
  active: boolean;
}

export default function ProductActions({ product }: { product: Product }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleActive() {
    setLoading(true);
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    router.refresh();
    setLoading(false);
  }

  async function deleteProduct() {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setLoading(true);
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleActive}
        disabled={loading}
        title={product.active ? "Hide product" : "Show product"}
      >
        {product.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={deleteProduct}
        disabled={loading}
        className="text-destructive hover:text-destructive"
        title="Delete product"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

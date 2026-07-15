import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { PLAN_PRODUCT_LIMITS } from "@/lib/commission";
import { Plus, Package } from "lucide-react";
import ProductActions from "@/components/ProductActions";
import SignOutButton from "@/components/SignOutButton";

export default async function ProductsPage() {
  const session = await auth();
  if (!session || session.user.role !== "SELLER") redirect("/login");

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { products: { orderBy: { createdAt: "desc" } } },
  });

  if (!profile) redirect("/onboarding");

  const limit = PLAN_PRODUCT_LIMITS[profile.plan];
  const activeCount = profile.products.filter((p) => p.active).length;
  const atLimit = limit !== null && activeCount >= limit;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-bold text-violet-700">
          MyHappinessClub
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild disabled={atLimit}>
            <Link href={atLimit ? "#" : "/products/new"}>
              <Plus className="w-4 h-4 mr-1" />
              Add product
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Products</h1>
          {limit !== null && (
            <p className="text-sm text-muted-foreground">
              {activeCount}/{limit} active (Free plan)
            </p>
          )}
        </div>

        {atLimit && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-800">
              You&apos;ve reached the 5-product limit on the Free plan.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Upgrade to Creator (€19/month) for unlimited products and lower commission.
            </p>
          </div>
        )}

        {profile.products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">No products yet</h2>
            <p className="text-muted-foreground mb-4">Add your first product to start selling.</p>
            <Button asChild>
              <Link href="/products/new">Add product</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.category ?? "No category"}</p>
                </div>
                <div className="text-right mr-4">
                  <p className="font-medium">{formatCurrency(product.price)}</p>
                  <Badge variant={product.active ? "default" : "secondary"} className="text-xs">
                    {product.active ? "Active" : "Hidden"}
                  </Badge>
                </div>
                <ProductActions product={product} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

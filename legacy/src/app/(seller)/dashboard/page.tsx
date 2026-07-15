import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Package, ShoppingBag, TrendingUp, Star } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "SELLER") redirect("/login");

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      products: { where: { active: true } },
      orders: {
        where: { status: "PAID" },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!profile) redirect("/onboarding");

  const totalRevenue = await prisma.order.aggregate({
    where: { sellerId: profile.id, status: "PAID" },
    _sum: { subtotal: true, commissionAmount: true },
    _count: true,
  });

  const netRevenue =
    (totalRevenue._sum.subtotal ?? 0) - (totalRevenue._sum.commissionAmount ?? 0);

  const stats = [
    {
      label: "Net revenue",
      value: formatCurrency(netRevenue),
      icon: TrendingUp,
      sub: `${totalRevenue._count} orders total`,
    },
    {
      label: "Active products",
      value: profile.products.length.toString(),
      icon: Package,
      sub: profile.plan === "FREE" ? `${5 - profile.products.length} remaining on Free` : "Unlimited",
    },
    {
      label: "Current plan",
      value: profile.plan,
      icon: Star,
      sub: profile.plan === "FREE" ? "Upgrade to Creator" : "Active subscription",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-violet-700">MyHappinessClub</span>
        <div className="flex items-center gap-3">
          <Link href={`/store/${profile.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
            View storefront
          </Link>
          <Button asChild>
            <Link href="/products/new">Add product</Link>
          </Button>
          <SignOutButton />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Welcome back, {profile.name}</h1>
          <p className="text-muted-foreground">
            Your store:{" "}
            <Link href={`/store/${profile.slug}`} className="text-violet-600 hover:underline">
              /store/{profile.slug}
            </Link>
          </p>
        </div>

        {profile.plan === "FREE" && (
          <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-violet-800">Upgrade to Creator</p>
              <p className="text-sm text-violet-600">
                Drop commission from 15% to 10% and get unlimited products for €19/month.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/onboarding">Upgrade</Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent orders</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {profile.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet. Share your storefront to get started!</p>
              ) : (
                <ul className="space-y-3">
                  {profile.orders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{order.items.map((i) => i.product.name).join(", ")}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.subtotal)}</p>
                        <Badge variant="secondary" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Your products</CardTitle>
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {profile.products.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No products yet.</p>
                  <Button asChild size="sm">
                    <Link href="/products/new">Add your first product</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {profile.products.slice(0, 5).map((product) => (
                    <li key={product.id} className="flex items-center justify-between text-sm">
                      <p className="font-medium truncate max-w-[160px]">{product.name}</p>
                      <p className="font-medium">{formatCurrency(product.price)}</p>
                    </li>
                  ))}
                </ul>
              )}
              {profile.products.length > 0 && (
                <Button asChild variant="outline" size="sm" className="w-full mt-3">
                  <Link href="/products">Manage products</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

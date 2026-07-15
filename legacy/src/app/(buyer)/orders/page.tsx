import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Package, CheckCircle } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { success } = await searchParams;

  const orders = await prisma.order.findMany({
    where: { buyerId: session.user.id },
    include: {
      items: { include: { product: true } },
      seller: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-violet-700">
          MyHappinessClub
        </Link>
        <SignOutButton />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Your orders</h1>

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800">Order placed!</p>
              <p className="text-sm text-green-700">
                Thank you for your purchase. Check below for your order details.
              </p>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-600">No orders yet</h2>
            <p className="text-muted-foreground mt-1">
              Browse storefronts to find something you love.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Link
                      href={`/store/${order.seller.slug}`}
                      className="font-semibold hover:text-violet-700"
                    >
                      {order.seller.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-IE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(order.subtotal)}</p>
                    <Badge
                      variant={order.status === "PAID" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
                <ul className="space-y-2 border-t pt-4">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.product.name}{" "}
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                      <span>{formatCurrency(item.priceAtPurchase * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

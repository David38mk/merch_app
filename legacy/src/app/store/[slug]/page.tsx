import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import ProductCard from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";
import Link from "next/link";
import { Package } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const profile = await prisma.sellerProfile.findUnique({ where: { slug } });
  if (!profile) return { title: "Store not found" };
  return { title: `${profile.name} — MyHappinessClub` };
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params;

  const profile = await prisma.sellerProfile.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!profile) notFound();

  const planLabel: Record<string, string> = {
    FREE: "Starter",
    CREATOR: "Creator",
    PRO: "Pro",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-violet-700">
          MyHappinessClub
        </Link>
        <CartDrawer />
      </nav>

      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-violet-700">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{profile.name}</h1>
                <Badge variant="secondary">{planLabel[profile.plan]}</Badge>
              </div>
              {profile.bio && (
                <p className="text-gray-600 max-w-xl">{profile.bio}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {profile.products.length} product{profile.products.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {profile.products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-600">No products yet</h2>
            <p className="text-muted-foreground mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {profile.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                sellerId={profile.id}
                sellerSlug={profile.slug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

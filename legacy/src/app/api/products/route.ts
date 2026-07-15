import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_PRODUCT_LIMITS } from "@/lib/commission";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { products: { orderBy: { createdAt: "desc" } } },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ products: profile.products, plan: profile.plan });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });

  if (!profile) return NextResponse.json({ error: "Complete onboarding first." }, { status: 400 });

  const limit = PLAN_PRODUCT_LIMITS[profile.plan];
  if (limit !== null && profile._count.products >= limit) {
    return NextResponse.json(
      { error: `Free plan is limited to ${limit} products. Upgrade to Creator to add more.` },
      { status: 403 }
    );
  }

  const { name, description, price, imageUrl, category } = await req.json();

  if (!name || !price) {
    return NextResponse.json({ error: "Name and price are required." }, { status: 400 });
  }

  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      sellerId: profile.id,
      name,
      description,
      price,
      imageUrl,
      category,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}

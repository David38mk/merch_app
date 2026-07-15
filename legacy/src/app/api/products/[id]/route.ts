import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSellerProduct(userId: string, productId: string) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  return prisma.product.findFirst({ where: { id: productId, sellerId: profile.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await getSellerProduct(session.user.id, id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates = await req.json();
  const allowed = ["name", "description", "price", "imageUrl", "category", "active"];
  const data = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  const updated = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ product: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await getSellerProduct(session.user.id, id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

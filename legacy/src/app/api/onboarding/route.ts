import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plan } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "Storefront already set up." }, { status: 409 });
  }

  const { name, slug, bio, plan } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug can only contain lowercase letters, numbers, and hyphens." },
      { status: 400 }
    );
  }

  const slugTaken = await prisma.sellerProfile.findUnique({ where: { slug } });
  if (slugTaken) {
    return NextResponse.json({ error: "That URL is already taken." }, { status: 409 });
  }

  const validPlans: Plan[] = ["FREE", "CREATOR", "PRO"];
  const resolvedPlan: Plan = validPlans.includes(plan) ? plan : "FREE";

  const profile = await prisma.sellerProfile.create({
    data: {
      userId: session.user.id,
      name,
      slug,
      bio,
      plan: resolvedPlan,
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}

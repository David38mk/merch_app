import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const sellerRoutes = ["/dashboard", "/products", "/onboarding", "/analytics"];
  const buyerRoutes = ["/orders"];
  const authRoutes = ["/login", "/signup"];

  const isSellerRoute = sellerRoutes.some((r) => pathname.startsWith(r));
  const isBuyerRoute = buyerRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));

  if ((isSellerRoute || isBuyerRoute) && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isSellerRoute && session?.user?.role !== "SELLER") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isBuyerRoute && session?.user?.role !== "BUYER") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isAuthRoute && session) {
    const dest =
      session.user.role === "SELLER" ? "/dashboard" : "/";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

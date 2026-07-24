import { LayoutDashboard, LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../auth";
import { cn } from "../../lib/cn";
import { CartButton } from "../cart/CartButton";
import { Button } from "../ui/Button";
import { Brand } from "./Brand";

const links = [
  { to: "/", label: "Explore" },
  { to: "/sell", label: "For creators" },
];

export function PublicLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            {links
              .filter((l) => l.to !== "/sell" || !user)
              .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100",
                    isActive && "text-brand-700",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <CartButton />
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout} title="Log out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-slate-400 sm:flex-row">
          <Brand />
          <p>© {2026} MyHappinessClub · walking-skeleton build</p>
        </div>
      </footer>
    </div>
  );
}

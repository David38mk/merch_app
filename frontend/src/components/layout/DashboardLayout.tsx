import { LayoutDashboard, LogOut, Store } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../auth";
import { cn } from "../../lib/cn";
import { Brand } from "./Brand";
import { NAV_GROUPS } from "./nav";
import { NotificationsMenu } from "./NotificationsMenu";
import { ProfileMenu } from "./ProfileMenu";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const roles = new Set(user.roles);
  const groups = NAV_GROUPS.filter((g) => roles.has(g.role));

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100",
    );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Brand />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <NavLink to="/dashboard" end className={linkClass}>
            <LayoutDashboard className="h-4 w-4" /> Overview
          </NavLink>

          {groups.map((group) => (
            <div key={group.role}>
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    <item.icon className="h-4 w-4" /> {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials(user.display_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{user.display_name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <button onClick={logout} title="Log out" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:flex"
            >
              <Store className="h-4 w-4" /> Marketplace
            </Link>
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

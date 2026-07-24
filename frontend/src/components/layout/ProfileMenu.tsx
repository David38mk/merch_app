import { useMutation } from "@tanstack/react-query";
import { LogOut, Palette, Settings as SettingsIcon, Store, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { enableDesigner } from "../../api/designers";
import { useAuth } from "../../auth";
import { useClickOutside } from "../../hooks/useClickOutside";

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
  return letters.toUpperCase() || "?";
}

export function ProfileMenu() {
  const { user, logout, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);

  const becomeDesigner = useMutation({
    mutationFn: enableDesigner,
    onSuccess: async () => {
      await refreshUser(); // pick up the new role so the designer nav appears
      setOpen(false);
      navigate("/designer");
    },
  });

  if (!user) return null;
  const isSeller = user.roles.includes("SELLER");
  const isDesigner = user.roles.includes("DESIGNER");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 ring-offset-2 transition hover:ring-2 hover:ring-brand-200"
        title="Account"
        aria-label="Account menu"
      >
        {initials(user.display_name)}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-800">{user.display_name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <div className="py-1">
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4 text-slate-400" /> Dashboard
            </Link>
            {isSeller && (
              <Link
                to="/seller/storefront"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Store className="h-4 w-4 text-slate-400" /> My storefront
              </Link>
            )}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <SettingsIcon className="h-4 w-4 text-slate-400" /> Settings
            </Link>
            {!isDesigner && (
              <button
                onClick={() => becomeDesigner.mutate()}
                disabled={becomeDesigner.isPending}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Palette className="h-4 w-4 text-slate-400" />
                {becomeDesigner.isPending ? "Enabling…" : "Become a designer"}
              </button>
            )}
          </div>
          <div className="border-t border-slate-100 py-1">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 text-slate-400" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Menu, Search, Settings, Sparkles, UserRound } from "lucide-react";
import CommandPalette from "@/components/dashboard/command-palette";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "AI Strategy", href: "/dashboard/ai-strategy" },
  { name: "Resume", href: "/dashboard/resume" },
  { name: "Profile", href: "/dashboard/profile" },
  { name: "Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { user, isBooting, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const displayName = user?.username || "User";
  const displayEmail = user?.email || "";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";
  const isInterviewWorkspace = pathname?.startsWith("/dashboard/interview");

  const openWorkspaceSearch = () => {
    window.dispatchEvent(new Event("workspace-search:open"));
  };

  useEffect(() => {
    if (!profileMenuOpen) return;

    function handlePointerDown(event) {
      if (
        profileMenuRef.current?.contains(event.target) ||
        profileTriggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setProfileMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        profileTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  function focusProfileMenuItem(direction = 1) {
    const items = Array.from(
      profileMenuRef.current?.querySelectorAll("[role='menuitem']") || []
    );
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement);
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function handleProfileTriggerKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProfileMenuOpen(true);
      requestAnimationFrame(() => focusProfileMenuItem());
    }
  }

  function handleProfileMenuKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusProfileMenuItem(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 px-6">
          <div className="h-3 w-32 animate-pulse rounded-full bg-surface-3" />
          <div className="h-24 animate-pulse rounded-xl border border-border bg-surface-1" />
          <div className="h-24 animate-pulse rounded-xl border border-border bg-surface-1" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting to sign in...
      </div>
    );
  }

  if (isInterviewWorkspace) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <BackgroundGlow />
        <main className="relative min-h-screen px-3 py-3 md:px-5 md:py-5">
          {children}
        </main>
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundGlow />

      <header className="sticky top-0 z-30 border-b border-border bg-background/84 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[100rem] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-1 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-none tracking-tight">
                  Strategy Hub
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Career workspace
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={openWorkspaceSearch}
              className="hidden h-10 w-[min(24rem,34vw)] items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-2 md:flex"
            >
              <Search className="size-4" />
              Search workspace
            </button>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive =
                item.name === "Dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-white",
                    isActive && "bg-surface-1 text-white"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <div className="relative hidden lg:block">
              <button
                ref={profileTriggerRef}
                type="button"
                className="rounded-full outline-none ring-offset-background transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((current) => !current)}
                onKeyDown={handleProfileTriggerKeyDown}
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>

              {profileMenuOpen ? (
                <div
                  ref={profileMenuRef}
                  role="menu"
                  aria-label="Profile menu"
                  onKeyDown={handleProfileMenuKeyDown}
                  className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                >
                  <div className="px-2 py-2">
                    <span className="block text-sm font-semibold text-foreground">{displayName}</span>
                    <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                      {displayEmail}
                    </span>
                  </div>
                  <div className="-mx-1 my-1 h-px bg-border" />
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <UserRound className="size-4" />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <Settings className="size-4" />
                    Settings
                  </Link>
                  <div className="-mx-1 my-1 h-px bg-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                    className="flex h-9 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>

            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="lg:hidden" />
                }
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-border bg-sidebar p-0">
                <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none">Strategy Hub</p>
                    <p className="mt-1 text-xs text-muted-foreground">Career workspace</p>
                  </div>
                </div>
                <nav className="space-y-1 p-3">
                  {navItems.map((item) => (
                    <SheetClose key={item.name} render={<Link href={item.href} />}>
                      <span className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        {item.name}
                      </span>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto border-t border-sidebar-border p-4">
                  <div className="mb-3 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="w-full justify-start" onClick={logout}>
                    <LogOut className="size-4" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="relative px-4 py-5 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[100rem]">{children}</div>
      </main>

      <CommandPalette />
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 opacity-80">
      <div className="animate-ambient absolute left-1/2 top-[-20rem] h-[34rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.20),transparent_68%)] blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#0B0F14_80%)]" />
    </div>
  );
}

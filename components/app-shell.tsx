"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { HomeIcon, MenuIcon, PlusIcon, SearchIcon, ToolboxIcon, UserIcon } from "./icons";
import { SiteFooter } from "./site-footer";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

const primaryNav = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/lookup", label: "Lookup", icon: SearchIcon },
  { href: "/assets", label: "Assets", icon: ToolboxIcon },
  { href: "/register", label: "Add", icon: PlusIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountHref = signedIn ? "/dashboard" : "/login";
  const accountLabel = signedIn ? "Dashboard" : "Account";
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="siteHeader">
        <div className="headerInner">
          <Brand />
          <nav className="desktopNav" aria-label="Primary navigation">
            <Link className={isActive("/lookup") ? "active" : ""} href="/lookup">Check an asset</Link>
            {signedIn && <Link className={isActive("/dashboard") ? "active" : ""} href="/dashboard">Dashboard</Link>}
            <Link className={isActive("/assets") ? "active" : ""} href="/assets">My assets</Link>
            <Link className={isActive("/register") ? "active" : ""} href="/register">Register</Link>
            {signedIn && <Link className={isActive("/locations") ? "active" : ""} href="/locations">Locations</Link>}
            {signedIn && <Link className={isActive("/team") ? "active" : ""} href="/team">Team</Link>}
            <Link className={isActive("/shop") ? "active" : ""} href="/shop">Shop</Link>
          </nav>
          <div className="headerActions">
            <Link className="headerAccount" href={accountHref}><UserIcon /><span>{accountLabel}</span></Link>
            <button className="headerMenuButton" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MenuIcon /></button>
          </div>
        </div>
        {menuOpen && <nav className="mobileDrawer" aria-label="More navigation">
          {signedIn && <Link href="/dashboard">Dashboard</Link>}
          <Link href="/assets">My assets</Link>
          <Link href="/register">Register asset</Link>
          <Link href="/import">Bulk import</Link>
          <Link href="/locations">Locations</Link>
          <Link href="/team">Team</Link>
          <Link href="/transfer">Accept transfer</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/shop/orders">My orders</Link>
          <Link href="/account">Account & plan</Link>
        </nav>}
      </header>

      <main className="siteMain">{children}</main>
      <SiteFooter />

      <nav className="bottomNav" aria-label="Mobile navigation">
        {primaryNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
        <Link href={signedIn ? "/account" : accountHref} className={pathname.startsWith("/account") || (!signedIn && pathname.startsWith("/login")) ? "active" : ""}>
          <UserIcon />
          <span>Account</span>
        </Link>
      </nav>
    </>
  );
}

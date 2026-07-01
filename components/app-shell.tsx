"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { HomeIcon, MenuIcon, PlusIcon, SearchIcon, ToolboxIcon, UserIcon } from "./icons";
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

  return <>
    <header className="siteHeader"><div className="headerInner"><Brand />
      <nav className="desktopNav" aria-label="Primary navigation">
        <Link href="/lookup">Check an asset</Link>
        {signedIn && <Link href="/dashboard">Dashboard</Link>}
        <Link href="/assets">My assets</Link>
        <Link href="/register">Register</Link>
        <Link href="/shop">Shop</Link>
      </nav>
      <div className="headerActions"><Link className="headerAccount" href={accountHref}><UserIcon /><span>{accountLabel}</span></Link><button className="headerMenuButton" type="button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><MenuIcon /></button></div>
    </div>
    {menuOpen && <nav className="mobileDrawer" aria-label="More navigation">
      {signedIn && <Link href="/dashboard">Dashboard</Link>}
      <Link href="/assets">My assets</Link><Link href="/register">Register asset</Link>
      {signedIn && <><Link href="/team">Team</Link><Link href="/account/orders">My orders</Link><Link href="/account">Account</Link></>}
      <Link href="/shop">Shop</Link>
    </nav>}</header>
    <main className="siteMain">{children}</main>
    <nav className="bottomNav" aria-label="Mobile navigation">
      {primaryNav.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={isActive(href)?"active":""}><Icon/><span>{label}</span></Link>)}
      <Link href={signedIn?"/account":accountHref} className={pathname.startsWith("/account")||(!signedIn&&pathname.startsWith("/login"))?"active":""}><UserIcon/><span>Account</span></Link>
    </nav>
  </>;
}

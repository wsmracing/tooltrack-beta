"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { HomeIcon, PlusIcon, SearchIcon, ToolboxIcon, UserIcon } from "./icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

const primaryNav = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/lookup", label: "Lookup", icon: SearchIcon },
  { href: "/dashboard", label: "My tools", icon: ToolboxIcon },
  { href: "/register", label: "Register", icon: PlusIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const accountHref = signedIn ? "/dashboard" : "/login";
  const accountLabel = signedIn ? "Dashboard" : "Account";
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

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
            <Link href="/lookup">Check a tool</Link>
            <Link href="/dashboard">My tools</Link>
            <Link href="/register">Register</Link>
            <Link href="/shop">Shop</Link>
          </nav>
          <Link className="headerAccount" href={accountHref}><UserIcon /><span>{accountLabel}</span></Link>
        </div>
      </header>

      <main className="siteMain">{children}</main>

      <nav className="bottomNav" aria-label="Mobile navigation">
        {primaryNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
        <Link href={accountHref} className={!signedIn && pathname.startsWith("/login") ? "active" : ""}>
          <UserIcon />
          <span>Account</span>
        </Link>
      </nav>
    </>
  );
}

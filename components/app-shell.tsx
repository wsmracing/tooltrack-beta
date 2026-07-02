"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import {
  CloseIcon,
  HomeIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  ShopIcon,
  ToolboxIcon,
  TransferIcon,
  UserIcon,
  UsersIcon,
} from "./icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

const primaryNav = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/lookup", label: "Lookup", icon: SearchIcon },
  { href: "/assets", label: "Assets", icon: ToolboxIcon },
  { href: "/register", label: "Add", icon: PlusIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const accountHref = signedIn ? "/account" : "/login";
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(closeMenu, [pathname, closeMenu]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnGesture = () => closeMenu();
    window.addEventListener("wheel", closeOnGesture, { passive: true });
    window.addEventListener("touchmove", closeOnGesture, { passive: true });
    window.addEventListener("popstate", closeOnGesture);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("wheel", closeOnGesture);
      window.removeEventListener("touchmove", closeOnGesture);
      window.removeEventListener("popstate", closeOnGesture);
    };
  }, [menuOpen, closeMenu]);

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    closeMenu();
    if (isSupabaseConfigured()) await getSupabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const drawerLink = (href: string, label: string, Icon?: typeof ShopIcon) => (
    <Link href={href} onClick={closeMenu}>
      {Icon && <Icon />}
      <span>{label}</span>
    </Link>
  );

  return <>
    <header className="siteHeader">
      <div className="headerInner">
        <Brand onClick={closeMenu} />
        <nav className="desktopNav" aria-label="Primary navigation">
          <Link href="/lookup">Check an asset</Link>
          {signedIn && <Link href="/dashboard">Dashboard</Link>}
          <Link href="/assets">My assets</Link>
          <Link href="/register">Register</Link>
          <Link href="/shop">Shop</Link>
        </nav>
        <div className="headerActions">
          <Link className="headerAccount" href={accountHref} aria-label={signedIn ? "Open account" : "Sign in"} onClick={closeMenu}>
            <UserIcon />
            <span>{signedIn ? "Account" : "Sign in"}</span>
          </Link>
          <button className="headerMenuButton" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {menuOpen && <>
        <button className="mobileDrawerBackdrop" type="button" aria-label="Close menu" onClick={closeMenu} />
        <nav className="mobileDrawer" aria-label="More navigation">
          {signedIn && drawerLink("/team", "Team", UsersIcon)}
          {drawerLink("/transfer", "Claim transferred asset", TransferIcon)}
          {signedIn && drawerLink("/account/orders", "My orders", ShopIcon)}
          {drawerLink("/shop", "Shop", ShopIcon)}
          {drawerLink("/help", "Help & support")}
          {signedIn ? <button type="button" className="mobileLogout" onClick={() => void logout()}>Log out</button> : drawerLink("/login", "Sign in")}
        </nav>
      </>}
    </header>
    <main className="siteMain">{children}</main>
    <nav className="bottomNav" aria-label="Mobile navigation">
      {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><Icon /><span>{label}</span></Link>)}
    </nav>
  </>;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [teamAvailable, setTeamAvailable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const accountHref = signedIn ? "/account" : "/login";
  const homeHref = signedIn ? "/dashboard" : "/";

  const primaryNav = useMemo(() => [
    { href: homeHref, label: "Home", icon: HomeIcon },
    { href: "/lookup", label: "Check", icon: SearchIcon },
    { href: "/assets", label: "Assets", icon: ToolboxIcon },
    { href: "/register", label: "Add", icon: PlusIcon },
  ], [homeHref]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  useEffect(closeMenu, [pathname, closeMenu]);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setAuthChecked(true); return; }
    const supabase = getSupabaseBrowser();
    const syncAccount = async (userId?: string) => {
      setSignedIn(Boolean(userId));
      if (!userId) { setTeamAvailable(false); setAuthChecked(true); return; }
      const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", userId).maybeSingle();
      setTeamAvailable(profile?.plan_tier === "team" || profile?.plan_tier === "fleet");
      setAuthChecked(true);
    };
    void supabase.auth.getUser().then(({ data }) => void syncAccount(data.user?.id));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAccount(session?.user?.id);
    });
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
    setSignedIn(false);
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
        <Brand href={homeHref} onClick={closeMenu} />
        <nav className="desktopNav" aria-label="Primary navigation">
          {signedIn ? <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/lookup">Check</Link>
            <Link href="/assets">Assets</Link>
            <Link href="/register">Add asset</Link>
          </> : <>
            <Link href="/lookup">Check</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/login">Sign in</Link>
          </>}
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
          {signedIn && drawerLink("/transfer", "Claim transferred asset", TransferIcon)}
          {signedIn && teamAvailable && drawerLink("/team", "Team", UsersIcon)}
          {signedIn && drawerLink("/account/orders", "My orders", ShopIcon)}
          {drawerLink("/shop", "Shop", ShopIcon)}
          {drawerLink("/help", "Help & support")}
          {signedIn ? <button type="button" className="mobileLogout" onClick={() => void logout()}>Log out</button> : <>
            {drawerLink("/login?mode=signup", "Create account", UserIcon)}
            {drawerLink("/login", "Sign in", UserIcon)}
          </>}
        </nav>
      </>}
    </header>
    <main className="siteMain">{children}</main>
    <footer className="siteFooter"><div className="pageWidth"><span>ToolTrack</span><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav></div></footer>
    {signedIn && authChecked && <nav className="bottomNav" aria-label="Mobile navigation">
      {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><Icon /><span>{label}</span></Link>)}
    </nav>}
  </>;
}

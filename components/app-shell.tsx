"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { ThemeSwitcher } from "./theme-switcher";
import {
  HelpIcon, HomeIcon, InfoIcon, PlusIcon, SearchIcon, ShopIcon, ToolboxIcon,
  TransferIcon, UserIcon, UsersIcon,
} from "./icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [teamAvailable, setTeamAvailable] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const closeAccountMenu = useCallback(() => setAccountOpen(false), []);
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

  useEffect(() => { closeAccountMenu(); }, [pathname, closeAccountMenu]);

  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: MouseEvent | TouchEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) closeAccountMenu();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeAccountMenu(); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen, closeAccountMenu]);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setAuthChecked(true); return; }
    const supabase = getSupabaseBrowser();
    const sync = async (userId?: string) => {
      setSignedIn(Boolean(userId));
      if (!userId) { setTeamAvailable(false); setAuthChecked(true); return; }
      const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", userId).maybeSingle();
      setTeamAvailable(profile?.plan_tier === "team" || profile?.plan_tier === "fleet");
      setAuthChecked(true);
    };
    void supabase.auth.getUser().then(({ data }) => void sync(data.user?.id));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => void sync(session?.user?.id));
    return () => data.subscription.unsubscribe();
  }, []);

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    closeAccountMenu();
    if (isSupabaseConfigured()) await getSupabaseBrowser().auth.signOut();
    setSignedIn(false);
    router.replace("/");
    router.refresh();
  }

  const menuLink = (href: string, label: string, Icon?: typeof ShopIcon) => (
    <Link href={href} onClick={closeAccountMenu}>{Icon && <Icon />}<span>{label}</span></Link>
  );

  if (pathname === "/beta-access") return <main className="betaGateMain">{children}</main>;

  return <>
    <header className="siteHeader">
      <div className="headerInner">
        <Brand href="/" onClick={closeAccountMenu} />
        <nav className="desktopNav" aria-label="Primary navigation">
          {signedIn ? <>
            <Link href="/dashboard">Dashboard</Link><Link href="/lookup">Check</Link>
            <Link href="/assets">Assets</Link><Link href="/register">Add asset</Link><Link href="/shop">Shop</Link>
          </> : <>
            <Link href="/lookup">Check</Link><Link href="/how-it-works">How it works</Link><Link href="/shop">Shop</Link>
          </>}
        </nav>
        <div className="headerActions">
          <ThemeSwitcher />
          <div className="accountMenuWrap" ref={accountMenuRef}>
            <button className="headerAccount" type="button"
              aria-label={signedIn ? "Open ToolTrack menu" : "Open ToolTrack menu"}
              aria-haspopup="menu" aria-expanded={accountOpen}
              onClick={() => setAccountOpen(value => !value)}>
              <UserIcon /><span>{signedIn ? "Account" : "Menu"}</span>
              <span className="accountMenuCaret" aria-hidden="true">▾</span>
            </button>
            {accountOpen && <nav className="accountDropdown unifiedMobileMenu" aria-label="ToolTrack menu">
              {signedIn ? <>
                {menuLink("/dashboard", "Dashboard", HomeIcon)}
                {menuLink("/lookup", "Check a serial", SearchIcon)}
                {menuLink("/assets", "My assets", ToolboxIcon)}
                {menuLink("/register", "Add asset", PlusIcon)}
                {menuLink("/transfer", "Claim transferred asset", TransferIcon)}
                {menuLink("/shop", "Shop", ShopIcon)}
                {menuLink("/account/orders", "My orders", ShopIcon)}
                {teamAvailable && menuLink("/team", "Team", UsersIcon)}
                {menuLink("/account", "Account", UserIcon)}
                {menuLink("/help", "Help & support", HelpIcon)}
                <div className="accountDropdownDivider" />
                <button type="button" className="accountDropdownLogout" onClick={() => void logout()}>Log out</button>
              </> : <>
                <div className="mobileOnlyMenuItems">
                  {menuLink("/", "Home", HomeIcon)}
                  {menuLink("/lookup", "Check a serial", SearchIcon)}
                  {menuLink("/how-it-works", "How it works", InfoIcon)}
                  {menuLink("/shop", "Shop", ShopIcon)}
                  {menuLink("/help", "Help & support", HelpIcon)}
                  <div className="accountDropdownDivider" />
                </div>
                {menuLink("/login", "Sign in", UserIcon)}
                {menuLink("/login?mode=signup", "Create account", PlusIcon)}
              </>}
            </nav>}
          </div>
        </div>
      </div>
    </header>
    <main className="siteMain">{children}</main>
    <footer className="siteFooter"><div className="pageWidth"><span>© 2026 ToolTrack Technologies Limited</span><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav></div></footer>
    {signedIn && authChecked && <nav className="bottomNav" aria-label="Mobile navigation">
      {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><Icon /><span>{label}</span></Link>)}
    </nav>}
  </>;
}

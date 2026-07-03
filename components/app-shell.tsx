"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { ThemeSwitcher } from "./theme-switcher";
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
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

  useEffect(() => {
    closeMenu();
    closeAccountMenu();
  }, [pathname, closeMenu, closeAccountMenu]);


  useEffect(() => {
    if (!accountOpen) return;

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) closeAccountMenu();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAccountMenu();
    };
    const closeOnScroll = () => closeAccountMenu();

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [accountOpen, closeAccountMenu]);

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
    closeAccountMenu();
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
            <Link href="/shop">Shop</Link>
          </> : <>
            <Link href="/lookup">Check</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/shop">Shop</Link>
          </>}
        </nav>
        <div className="headerActions">
          <ThemeSwitcher />
          <div className="accountMenuWrap" ref={accountMenuRef}>
            <button
              className="headerAccount"
              type="button"
              aria-label={signedIn ? "Open account menu" : "Open sign in menu"}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => {
                closeMenu();
                setAccountOpen((value) => !value);
              }}
            >
              <UserIcon />
              <span>{signedIn ? "Account" : "Sign in"}</span>
              <span className="accountMenuCaret" aria-hidden="true">▾</span>
            </button>
            {accountOpen && <nav className="accountDropdown" aria-label={signedIn ? "Account menu" : "Sign in menu"}>
              {signedIn ? <>
                <Link href="/account" onClick={closeAccountMenu}><UserIcon /><span>Account</span></Link>
                <Link href="/account/orders" onClick={closeAccountMenu}><ShopIcon /><span>My orders</span></Link>
                {teamAvailable && <Link href="/team" onClick={closeAccountMenu}><UsersIcon /><span>Team</span></Link>}
                <div className="accountDropdownDivider" />
                <button type="button" className="accountDropdownLogout" onClick={() => void logout()}>Log out</button>
              </> : <>
                <Link href="/login" onClick={closeAccountMenu}><UserIcon /><span>Sign in</span></Link>
                <Link href="/login?mode=signup" onClick={closeAccountMenu}><PlusIcon /><span>Create account</span></Link>
              </>}
            </nav>}
          </div>
          <button className="headerMenuButton" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => {
            closeAccountMenu();
            setMenuOpen((value) => !value);
          }}>
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {menuOpen && <>
        <button className="mobileDrawerBackdrop" type="button" aria-label="Close menu" onClick={closeMenu} />
        <nav className="mobileDrawer" aria-label="More navigation">
          {signedIn && drawerLink("/transfer", "Claim transferred asset", TransferIcon)}
          {drawerLink("/shop", "Shop", ShopIcon)}
          {drawerLink("/help", "Help & support")}
        </nav>
      </>}
    </header>
    <main className="siteMain">{children}</main>
    <footer className="siteFooter"><div className="pageWidth"><span>© 2026 ToolTrack Technologies Limited</span><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav></div></footer>
    {signedIn && authChecked && <nav className="bottomNav" aria-label="Mobile navigation">
      {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? "active" : ""}><Icon /><span>{label}</span></Link>)}
    </nav>}
  </>;
}

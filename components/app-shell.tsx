"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { HomeIcon, PlusIcon, SearchIcon, ShopIcon, ToolboxIcon, UserIcon } from "./icons";

const nav = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/lookup", label: "Lookup", icon: SearchIcon },
  { href: "/dashboard", label: "My tools", icon: ToolboxIcon },
  { href: "/register", label: "Register", icon: PlusIcon },
  { href: "/login", label: "Account", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

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
          <Link className="headerAccount" href="/login"><UserIcon /><span>Account</span></Link>
        </div>
      </header>

      <main className="siteMain">{children}</main>

      <nav className="bottomNav" aria-label="Mobile navigation">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

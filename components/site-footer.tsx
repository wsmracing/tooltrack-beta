import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="footerInner">
        <div>
          <strong>ToolTrack</strong>
          <p>© 2026 ToolTrack Technologies Limited, trading as ToolTrack.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/shop/orders">My orders</Link>
        </nav>
      </div>
    </footer>
  );
}

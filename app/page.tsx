import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { AlertIcon, CameraIcon, FileIcon, SearchIcon, ShieldIcon, ToolboxIcon } from "@/components/icons";

export default function HomePage() {
  return (
    <>
      <section className="homeHero">
        <div className="pageWidth homeHeroInner">
          <p className="eyebrow red">Tool and asset protection</p>
          <h1>Check a tool before you buy.</h1>
          <p className="homeLead">Search a serial number for free, or register your own tools and equipment with photos and proof of ownership.</p>
          <LookupForm />
          <div className="homeActions">
            <Link className="button primary large" href="/register">Register an asset</Link>
            <Link className="button secondary large" href="/dashboard">View my assets</Link>
          </div>
          <p className="homeDisclaimer">No match does not guarantee that an item is legitimate. Always check the seller and inspect the item in person.</p>
        </div>
      </section>

      <section className="pageWidth quickGrid cleanQuickGrid" aria-label="Main actions">
        <Link href="/register"><span className="quickIcon"><ToolboxIcon /></span><strong>Register an asset</strong><small>Save serials, photos and ownership documents</small></Link>
        <Link href="/dashboard"><span className="quickIcon"><AlertIcon /></span><strong>Report stolen</strong><small>Flag one of your registered assets quickly</small></Link>
        <Link href="/lookup"><span className="quickIcon"><SearchIcon /></span><strong>Check a serial</strong><small>Free public lookup before buying used equipment</small></Link>
      </section>

      <section className="pageWidth sectionBlock homeFeatures">
        <div className="sectionHeading"><p className="eyebrow red">Simple and private</p><h2>Keep the important details together.</h2><p>ToolTrack is designed for phones, so you can register an asset while standing beside it.</p></div>
        <div className="featureGrid">
          <article><CameraIcon /><h3>Photograph the asset</h3><p>Capture the full item, serial plate and any unique marks directly from your phone.</p></article>
          <article><FileIcon /><h3>Store proof privately</h3><p>Receipts and invoices remain private and never appear in a public serial lookup.</p></article>
          <article><ShieldIcon /><h3>Warn potential buyers</h3><p>Mark an asset stolen and allow people to submit private sighting information.</p></article>
        </div>
      </section>
    </>
  );
}

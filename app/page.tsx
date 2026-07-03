import Link from "next/link";
import { HomeSearchHero } from "@/components/home-search-hero";
import { CameraIcon, FileIcon, ShieldIcon } from "@/components/icons";

export default function HomePage() {
  return <>
    <section className="homeHero v47HomeHero">
      <div className="pageWidth homeHeroInner">
        <h1>Check a tool before you buy.</h1>
        <p className="homeLead">Search a serial number, or create a dated record for your own tools and equipment.</p>
        <HomeSearchHero />
        <div className="homeActions singleHomeAction"><Link className="button primary large" href="/register">Register an asset</Link></div>
        <p className="homeDisclaimer">A missing record does not guarantee that an item is legitimate. Always inspect the item, seller and purchase evidence.</p>
      </div>
    </section>
    <section className="pageWidth sectionBlock homeFeatures v47HomeFeatures">
      <div className="sectionHeading"><h2>Keep the important details together.</h2></div>
      <div className="featureGrid compactFeatureGrid">
        <article><CameraIcon /><h3>Record the asset</h3><p>Save the serial number, photographs and identifying marks before anything goes wrong.</p></article>
        <article><FileIcon /><h3>Keep evidence private</h3><p>Receipts and invoices remain private and never appear in a public check.</p></article>
        <article><ShieldIcon /><h3>Sell or report with confidence</h3><p>Confirm a legitimate sale, transfer the record, or alert potential buyers after theft.</p></article>
      </div>
    </section>
  </>;
}

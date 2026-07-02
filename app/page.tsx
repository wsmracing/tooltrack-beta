import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { CameraIcon, FileIcon, ShieldIcon } from "@/components/icons";

export default function HomePage() {
  return <>
    <section className="homeHero v44HomeHero">
      <div className="pageWidth homeHeroInner">
        <p className="eyebrow red">Free public lookup</p>
        <h1>Check a tool before you buy.</h1>
        <p className="homeLead">Search a serial number, or register your own tools and equipment with photos and proof of ownership.</p>
        <LookupForm />
        <div className="homeActions singleHomeAction"><Link className="button primary large" href="/register">Register an asset</Link></div>
        <p className="homeDisclaimer">No match does not guarantee that an item is legitimate. Always inspect the item and seller details in person.</p>
      </div>
    </section>

    <section className="pageWidth sectionBlock homeFeatures v44HomeFeatures">
      <div className="sectionHeading"><p className="eyebrow red">Simple and private</p><h2>Keep the important details together.</h2></div>
      <div className="featureGrid compactFeatureGrid">
        <article><CameraIcon /><h3>Record the asset</h3><p>Photograph the item, serial plate and unique marks.</p></article>
        <article><FileIcon /><h3>Keep proof private</h3><p>Receipts and invoices never appear in public lookups.</p></article>
        <article><ShieldIcon /><h3>Report theft quickly</h3><p>Warn potential buyers and receive private sighting reports.</p></article>
      </div>
    </section>
  </>;
}

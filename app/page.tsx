import Link from "next/link";
import { LookupForm } from "@/components/lookup-form";
import { AlertIcon, CameraIcon, FileIcon, SearchIcon, ShieldIcon, ToolboxIcon } from "@/components/icons";

export default function HomePage() {
  return (
    <>
      <section className="heroSection">
        <div className="pageWidth heroGrid">
          <div className="heroCopy">
            <p className="eyebrow">Built for tradespeople</p>
            <h1>Register it <span>before it’s gone.</span></h1>
            <p className="lead">Keep serial numbers, tool photos, receipts and invoices together. Report theft quickly and help buyers check used tools before handing over money.</p>
            <LookupForm />
            <div className="heroButtons">
              <Link className="button primary large" href="/register">Register a tool</Link>
              <Link className="button secondary large" href="/dashboard">View my tools</Link>
            </div>
            <div className="trustLine"><span><ShieldIcon /> Private documents</span><span><SearchIcon /> Free public lookup</span><span><AlertIcon /> Fast stolen warning</span></div>
          </div>
          <div className="heroVisual" aria-hidden="true">
            <div className="toolSilhouette"><span className="drillBody"/><span className="drillChuck"/><span className="drillHandle"/><span className="drillBattery"/></div>
            <div className="heroBadge"><ShieldIcon /><div><strong>Ownership record</strong><span>Serial, photos & proof</span></div></div>
          </div>
        </div>
      </section>

      <section className="pageWidth quickGrid" aria-label="Main actions">
        <Link href="/register"><span className="quickIcon"><ToolboxIcon /></span><strong>Register a tool</strong><small>Add serial, photos and proof</small></Link>
        <Link href="/dashboard"><span className="quickIcon"><AlertIcon /></span><strong>Report stolen</strong><small>Flag an existing asset</small></Link>
        <Link href="/lookup"><span className="quickIcon"><SearchIcon /></span><strong>Check before buying</strong><small>Search a serial for free</small></Link>
        <Link href="/shop"><span className="quickIcon"><ShieldIcon /></span><strong>Security shop</strong><small>Tags, locks and markers</small></Link>
      </section>

      <section className="pageWidth sectionBlock">
        <div className="sectionHeading"><p className="eyebrow red">Made for the jobsite</p><h2>Get the important details recorded in minutes.</h2><p>Big controls, clear steps and no unnecessary paperwork while you are standing beside the tool.</p></div>
        <div className="featureGrid">
          <article><CameraIcon /><h3>Photograph it</h3><p>Capture the full tool, serial plate and unique marks directly from your phone.</p></article>
          <article><FileIcon /><h3>Keep proof private</h3><p>Receipts and invoices stay private and never appear in a public lookup.</p></article>
          <article><AlertIcon /><h3>Flag it quickly</h3><p>Mark an asset stolen and publish a warning without exposing your contact details.</p></article>
        </div>
      </section>
    </>
  );
}

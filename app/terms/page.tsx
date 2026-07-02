import Link from "next/link";

export default function TermsPage() {
  return <div className="pageWidth pagePad narrowContent contentPage">
    <p className="eyebrow red">Legal</p>
    <h1>Beta terms</h1>
    <div className="proseCard">
      <h2>ToolTrack records</h2>
      <p>ToolTrack creates dated records from information supplied by users. A registration, uploaded document, seller confirmation or transfer history may support an ownership claim, but it does not by itself prove legal ownership, authenticity, value or seller identity.</p>
      <h2>Acceptable use</h2>
      <p>Only register assets you own or are authorised to manage. False theft reports, misleading evidence, impersonation, abusive sightings and attempts to access another user&apos;s records are prohibited.</p>
      <h2>Checks before buying</h2>
      <p>A result showing no theft report is not a guarantee that an item is legitimate. Buyers should inspect the item, verify the seller and complete a ToolTrack transfer where available before paying.</p>
      <h2>Closed beta and shop</h2>
      <p>ToolTrack is in closed beta. Shop orders are requests only: payment, availability, delivery and any commercial terms will be confirmed separately before an order is fulfilled.</p>
      <p>These terms will be expanded before public commercial launch. For a disputed registration, use the <Link className="textLink" href="/disputes">dispute process</Link>.</p>
    </div>
  </div>;
}

import Link from "next/link";
import { ShieldIcon } from "@/components/icons";

export default function HelpPage() {
  return <div className="pageWidth pagePad contentPage"><div className="sectionTitleRow"><div><p className="eyebrow red">Help & support</p><h1>How can we help?</h1><p className="muted">Quick answers for registering, checking and transferring assets.</p></div><ShieldIcon /></div>
    <div className="helpGrid">
      <Link href="/how-it-works"><strong>How ToolTrack works</strong><span>Registration, public lookup and stolen reports</span></Link>
      <Link href="/transfer"><strong>Claim a transferred asset</strong><span>Enter a code supplied by the current owner</span></Link>
      <Link href="/disputes"><strong>Dispute or correct a record</strong><span>Report inaccurate or contested information</span></Link>
      <Link href="/shop/delivery-returns"><strong>Shop delivery & returns</strong><span>Prototype-shop information</span></Link>
      <Link href="/contact"><strong>Contact ToolTrack</strong><span>Support and privacy enquiries</span></Link>
      <Link href="/privacy"><strong>Privacy</strong><span>How personal information is handled</span></Link>
    </div>
  </div>;
}

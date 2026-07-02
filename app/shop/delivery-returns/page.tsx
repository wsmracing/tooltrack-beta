import Link from "next/link";

export default function DeliveryReturnsPage() {
  return <div className="pageWidth pagePad narrowContent contentPage">
    <p className="eyebrow red">Shop information</p>
    <h1>Delivery & returns</h1>
    <div className="proseCard">
      <p>During the closed beta, a submitted order is an enquiry rather than a completed online purchase. ToolTrack will confirm availability, price, payment and delivery before fulfilment.</p>
      <p>Commercial launch terms will set out delivery areas, charges, estimated times, cancellation rights, returns and the process for faulty goods.</p>
      <p>Do not send payment until you have received a direct confirmation from ToolTrack.</p>
      <Link className="button secondary" href="/shop">Return to shop</Link>
    </div>
  </div>;
}

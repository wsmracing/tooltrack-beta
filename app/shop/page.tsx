import type { Metadata } from "next";
import { ShieldIcon, ShopIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Security shop" };
const products = [
  ["Security marker pen", "UV ownership marking", "€8.99"],
  ["ToolTrack QR tags", "20 tamper-evident labels", "€14.99"],
  ["Bluetooth tracker", "Compact tool-case tracker", "€24.99"],
  ["Heavy-duty padlock", "Hardened shackle", "€18.99"],
  ["Van lock", "Additional rear-door security", "€68.99"],
  ["Ground anchor", "Workshop and garage fixing", "€49.99"],
];
export default function ShopPage() {
  return <div className="pageWidth pagePad"><div className="sectionTitleRow"><div><p className="eyebrow red">Prototype shop</p><h1>Security products</h1><p className="muted">Shop checkout is disabled during beta testing.</p></div><ShopIcon /></div><div className="productGrid">{products.map(([name, description, price]) => <article className="productCard" key={name}><div className="productVisual"><ShieldIcon /></div><h2>{name}</h2><p>{description}</p><strong>{price}</strong><button className="button secondary" disabled>Coming later</button></article>)}</div></div>;
}

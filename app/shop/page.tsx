import type { Metadata } from "next";
import { ShopIcon } from "@/components/icons";
import ShopClient from "./shop-client";

export const metadata: Metadata = { title: "Shop" };

export default function ShopPage() {
  return <div className="pageWidth pagePad">
    <div className="sectionTitleRow shopPageHeading">
      <div><p className="eyebrow red">Shop</p><h1>Tools & accessories</h1><p className="muted">Equipment, storage, identification and protection products.</p></div>
      <ShopIcon />
    </div>
    <ShopClient />
  </div>;
}

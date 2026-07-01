import type { Metadata } from "next";
import { ShopClient } from "./shop-client";
export const metadata: Metadata = { title: "Security shop" };
export default function ShopPage() { return <ShopClient />; }

import { Suspense } from "react";
import type { Metadata } from "next";
import { LookupClient } from "./lookup-client";

export const metadata: Metadata = { title: "Serial lookup" };

export default function LookupPage() {
  return <Suspense fallback={<div className="pageWidth pagePad"><div className="skeletonCard" /></div>}><LookupClient /></Suspense>;
}

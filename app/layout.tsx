import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: { default: "ToolTrack", template: "%s | ToolTrack" },
  description: "Register tools, store proof of ownership, report theft and check serial numbers before buying used equipment.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d71920",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}

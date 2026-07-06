import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./v48.css";
import "./gallery.css";
import "./v5.css";

import { AppShell } from "@/components/app-shell";
import { ToolTrackAnalytics } from "@/components/vercel-analytics";

const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tooltrack.ie";

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  title: {
    default: "ToolTrack",
    template: "%s | ToolTrack",
  },
  description:
    "Register tools, store purchase and ownership evidence, report theft and check serial numbers before buying used equipment.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#15171a" },
  ],
};

const appearanceScript = `
  (function () {
    try {
      var saved = localStorage.getItem('tooltrack-appearance');
      var appearance = saved === 'light' || saved === 'dark'
        ? saved
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.appearance = appearance;
      document.documentElement.style.colorScheme = appearance;
    } catch (_) {}
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ToolTrackAnalytics />
      </body>
    </html>
  );
}

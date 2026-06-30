import type { PublicLookupResult } from "./types";
import { normaliseSerial } from "./normalise";

const demo: Record<string, PublicLookupResult> = {
  MIL8891: {
    found: true,
    status: "stolen",
    make: "Milwaukee",
    model: "M18 FID3",
    category: "Impact driver",
    serialMasked: "••••8891",
    registeredAt: "2026-05-10",
    reportedAt: "2026-06-29",
    locationArea: "Dublin 12",
    publicReference: "TT-260629-8891",
    message: "This asset has been reported stolen. Do not purchase it.",
  },
  MAK4932: {
    found: true,
    status: "safe",
    make: "Makita",
    model: "DHR242",
    category: "Rotary hammer",
    serialMasked: "••••4932",
    registeredAt: "2026-06-29",
    message: "This asset is registered and is not currently marked as stolen.",
  },
  BOS2205: {
    found: true,
    status: "transfer",
    make: "Bosch Professional",
    model: "GWS 18V-10",
    category: "Angle grinder",
    serialMasked: "••••2205",
    registeredAt: "2026-04-18",
    message: "This asset is registered and an ownership transfer is pending.",
  },
};

export function getDemoLookup(serial: string): PublicLookupResult | null {
  return demo[normaliseSerial(serial)] ?? null;
}

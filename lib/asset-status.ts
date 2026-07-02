import type { Asset, AssetStatus, MarketStatus, VerificationLevel } from "@/lib/types";

export function assetStatusLabel(status: AssetStatus): string {
  switch (status) {
    case "stolen": return "Stolen";
    case "recovered": return "Recovered";
    case "transfer": return "Transfer pending";
    default: return "Registered";
  }
}

export function marketStatusLabel(status?: MarketStatus | null): string {
  switch (status) {
    case "for_sale": return "For sale";
    case "disputed": return "Disputed";
    default: return "Not for sale";
  }
}

export function verificationLabel(level?: VerificationLevel | null): string {
  switch (level) {
    case "evidence_supplied": return "Evidence supplied";
    case "retailer_verified": return "Retailer verified";
    case "transfer_history": return "Verified transfer history";
    case "disputed": return "Registration disputed";
    default: return "User registered";
  }
}

export function effectiveMarketStatus(asset: Pick<Asset, "market_status" | "sale_expires_at">): MarketStatus {
  if (asset.market_status === "for_sale" && asset.sale_expires_at && new Date(asset.sale_expires_at).getTime() <= Date.now()) {
    return "not_for_sale";
  }
  return asset.market_status ?? "not_for_sale";
}

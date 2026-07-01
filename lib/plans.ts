export type AccountType = "individual" | "tradesperson" | "business" | "hire_company";
export type PlanTier = "starter" | "pro" | "team" | "fleet";

export interface PlanDefinition {
  tier: PlanTier;
  accountType: AccountType;
  name: string;
  audience: string;
  assetLimit: number;
  memberLimit: number;
  bulkTools: boolean;
  teamTools: boolean;
  description: string;
  monthlyPrice: number;
  priceLabel: string;
  features: string[];
}

export const plans: PlanDefinition[] = [
  {
    tier: "starter",
    accountType: "individual",
    name: "Personal",
    audience: "Home and shed",
    assetLimit: 25,
    memberLimit: 1,
    bulkTools: false,
    teamTools: false,
    description: "A simple register for household, garden and personal tools.",
    monthlyPrice: 0,
    priceLabel: "Free",
    features: ["25 assets", "Photos and receipts", "Stolen lookup", "Sighting alerts"],
  },
  {
    tier: "pro",
    accountType: "tradesperson",
    name: "Trade",
    audience: "Sole traders",
    assetLimit: 250,
    memberLimit: 1,
    bulkTools: true,
    teamTools: false,
    description: "For a working tool collection, van or workshop.",
    monthlyPrice: 4.99,
    priceLabel: "€4.99 / month",
    features: ["250 assets", "Bulk edit", "CSV import/export", "PDF asset register"],
  },
  {
    tier: "team",
    accountType: "business",
    name: "Business",
    audience: "Teams and contractors",
    assetLimit: 2000,
    memberLimit: 20,
    bulkTools: true,
    teamTools: true,
    description: "Shared asset management for a small or growing business.",
    monthlyPrice: 9.99,
    priceLabel: "€9.99 / month",
    features: ["2,000 assets", "20 team members", "Shared locations", "Audit history"],
  },
  {
    tier: "fleet",
    accountType: "hire_company",
    name: "Fleet & Hire",
    audience: "Hire and large fleets",
    assetLimit: 10000,
    memberLimit: 100,
    bulkTools: true,
    teamTools: true,
    description: "Higher-volume registration, transfers and location control.",
    monthlyPrice: 24.99,
    priceLabel: "€24.99 / month",
    features: ["10,000 assets", "100 team members", "Transfers", "Fleet workflows"],
  },
];

export function getPlan(tier?: string | null) {
  return plans.find((plan) => plan.tier === tier) ?? plans[0];
}

export type AssetStatus = "safe" | "stolen" | "recovered" | "transfer";

export interface Asset {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  category: string;
  serial_original: string;
  serial_normalized: string;
  secondary_identifier: string | null;
  colour: string | null;
  storage_location: string | null;
  estimated_value: number | null;
  supplier: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  invoice_number: string | null;
  security_id: string | null;
  status: AssetStatus;
  registered_at: string;
  updated_at: string;
}

export interface PublicLookupResult {
  found: boolean;
  status: AssetStatus | "none";
  make?: string;
  model?: string;
  category?: string;
  serialMasked?: string;
  registeredAt?: string;
  reportedAt?: string;
  locationArea?: string;
  publicReference?: string;
  message: string;
}

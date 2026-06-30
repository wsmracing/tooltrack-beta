export function normaliseSerial(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function displaySerial(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function maskSerial(value: string): string {
  const clean = normaliseSerial(value);
  if (clean.length <= 4) return `••••${clean}`;
  return `${"•".repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`;
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export function normaliseOptionalUrl(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(clean) ? clean : `https://${clean}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

// Returns the last 9 digits of a phone number for AU mobile matching.
// 0403358404, +61403358404, 403 358 404 → all produce "403358404".
export function phoneSearchKey(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("61") && digits.length >= 11) return digits.slice(2)
  if (digits.startsWith("0") && digits.length >= 10) return digits.slice(1)
  return digits
}

// True when the query looks like a phone number (digits, spaces, +, -, parens).
export function isPhoneQuery(raw: string): boolean {
  return /^[\d\s()+\-]{7,}$/.test(raw.trim())
}

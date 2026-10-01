import { SignJWT, jwtVerify } from "jose"
import { createHash } from "crypto"

function getSecret(): Uint8Array {
  const secret = process.env.TOKEN_SIGNING_SECRET
  if (!secret) throw new Error("TOKEN_SIGNING_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: Record<string, unknown>, expiresIn: string = "30d"): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyToken<T extends object>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as T
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

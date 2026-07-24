import { randomBytes, createHash } from 'node:crypto'

const PAT_PREFIX = 'oqp_'

export interface GeneratedPat {
  raw: string
  hash: string
  prefix: string
}

/**
 * A PAT is a 256-bit CSPRNG value, not a human-chosen secret - brute force is
 * infeasible regardless of hash speed, so a fast unsalted SHA-256 lookup hash
 * is the right tradeoff (enables `where token_hash = $1`, indexed) rather
 * than bcrypt/argon2, which exist to slow down guessing low-entropy passwords.
 */
export function generatePat(): GeneratedPat {
  const raw = PAT_PREFIX + randomBytes(32).toString('base64url')
  return { raw, hash: hashPat(raw), prefix: raw.slice(0, 12) }
}

export function hashPat(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

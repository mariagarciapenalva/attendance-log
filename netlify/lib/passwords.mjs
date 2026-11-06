import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(String(password), salt, 32).toString('hex')}`
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored ?? '').split(':')
  if (!salt || !hash) return false
  const a = scryptSync(String(password ?? ''), salt, 32)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

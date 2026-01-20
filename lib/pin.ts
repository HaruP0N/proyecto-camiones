import bcrypt from "bcryptjs"

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin)
}

export async function hashPin(pin: string) {
  const saltRounds = 10
  return bcrypt.hash(pin, saltRounds)
}

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash)
}

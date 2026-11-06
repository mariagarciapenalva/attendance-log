// BJJ ranks. All numbers are guidelines only: the teacher always decides.
//
// Per belt:
//   classesPerStripe  classes needed for each stripe AND for the jump to the next belt
//                     (from 4 stripes, one more block of classes gives the next belt)
//   maxStripes        stripes (degrees on black) before the next belt
//   minMonths         minimum time AT this belt before moving to the next one
//                     (on the top belt: minimum time per degree)
//
// Adult times follow the IBJJF graduation system (blue 2 y, purple 1.5 y, brown 1 y,
// 3 y per black-belt degree). Classes per stripe come from the dojo's current app.
export const BELT_SYSTEMS = {
  'bjj-adult': {
    name: 'BJJ adultos',
    belts: [
      { name: 'Blanco', color: '#f3f4f6', classesPerStripe: 35,   maxStripes: 4, minMonths: 0 },
      { name: 'Azul',   color: '#1d4ed8', classesPerStripe: 65,   maxStripes: 4, minMonths: 24 },
      { name: 'Morado', color: '#7e22ce', classesPerStripe: 75,   maxStripes: 4, minMonths: 18 },
      { name: 'Marrón', color: '#78350f', classesPerStripe: 85,   maxStripes: 4, minMonths: 12 },
      { name: 'Negro',  color: '#111827', classesPerStripe: 1000, maxStripes: 6, minMonths: 36 },
    ],
  },
  // TODO: check the kids' plan in the dojo's current app ("SHOW ALL") and copy the real numbers
  'bjj-kids': {
    name: 'BJJ infantil',
    belts: [
      { name: 'Blanco',   color: '#f3f4f6', classesPerStripe: 12, maxStripes: 4, minMonths: 0 },
      { name: 'Gris',     color: '#9ca3af', classesPerStripe: 12, maxStripes: 4, minMonths: 0 },
      { name: 'Amarillo', color: '#facc15', classesPerStripe: 12, maxStripes: 4, minMonths: 0 },
      { name: 'Naranja',  color: '#f97316', classesPerStripe: 12, maxStripes: 4, minMonths: 0 },
      { name: 'Verde',    color: '#16a34a', classesPerStripe: 12, maxStripes: 4, minMonths: 0 },
    ],
  },
}

export const beltInfo = (belt) => BELT_SYSTEMS[belt?.system]?.belts[belt?.index] ?? null
const isTopBelt = (belt) => belt.index === BELT_SYSTEMS[belt.system].belts.length - 1

export function beltLabel(belt) {
  const b = beltInfo(belt)
  if (!b) return 'Sin cinturón'
  if (!belt.stripes) return b.name
  return `${b.name} · ${belt.stripes} grado${belt.stripes > 1 ? 's' : ''}`
}

// next stripe, or next belt with 0 stripes; null at the very top
export function nextRank(belt) {
  const b = beltInfo(belt)
  if (!b) return null
  if (belt.stripes < b.maxStripes) return { ...belt, stripes: belt.stripes + 1 }
  if (!isTopBelt(belt)) return { ...belt, index: belt.index + 1, stripes: 0 }
  return null
}

// whole months between two ISO dates (YYYY-MM-DD)
export function monthsBetween(fromIso, toIso) {
  const a = new Date(`${fromIso}T12:00:00Z`)
  const b = new Date(`${toIso}T12:00:00Z`)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
    - (b.getUTCDate() < a.getUTCDate() ? 1 : 0)
}

/**
 * Progress towards the next stripe and the next belt.
 * attended   classes attended since the last promotion (stripe or belt)
 * beltSince  date the current belt was received
 * promotedAt date of the last promotion (stripe or belt)
 * today      today's date
 */
export function rankProgress(belt, { attended, beltSince, promotedAt, today }) {
  const b = beltInfo(belt)
  if (!b) return null
  const next = nextRank(belt)
  const required = b.classesPerStripe
  const toNextStripe = Math.max(0, required - attended)

  // classes left to the next belt: this block + one block per remaining stripe
  const toNextBelt = isTopBelt(belt) ? null : toNextStripe + (b.maxStripes - belt.stripes) * required

  // minimum time applies to belt changes (and to each degree on the top belt)
  const timed = next && (next.index !== belt.index || isTopBelt(belt))
  const since = isTopBelt(belt) ? promotedAt : beltSince
  const monthsAtBelt = since ? monthsBetween(since, today) : 0
  // shown always (so students see it coming); only blocks "ready" when the next step is timed
  const time = { minMonths: b.minMonths ?? 0, months: monthsAtBelt, ok: monthsAtBelt >= (b.minMonths ?? 0) }

  return {
    attended,
    required,
    toNextStripe,
    toNextBelt,
    next,
    nextIsBelt: !!next && next.index !== belt.index,
    time,
    ready: !!next && attended >= required && (!timed || time.ok),
  }
}
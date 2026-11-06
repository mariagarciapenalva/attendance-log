// Simplified BJJ ranks. "classesPerStripe" is a guideline only: the teacher always decides.
export const BELT_SYSTEMS = {
  'bjj-adult': {
    name: 'BJJ adultos',
    classesPerStripe: 20,
    maxStripes: 4,
    belts: [
      { name: 'Blanco', color: '#f3f4f6' },
      { name: 'Azul', color: '#1d4ed8' },
      { name: 'Morado', color: '#7e22ce' },
      { name: 'Marrón', color: '#78350f' },
      { name: 'Negro', color: '#111827' },
    ],
  },
  'bjj-kids': {
    name: 'BJJ infantil',
    classesPerStripe: 12,
    maxStripes: 4,
    belts: [
      { name: 'Blanco', color: '#f3f4f6' },
      { name: 'Gris', color: '#9ca3af' },
      { name: 'Amarillo', color: '#facc15' },
      { name: 'Naranja', color: '#f97316' },
      { name: 'Verde', color: '#16a34a' },
    ],
  },
}

export function beltLabel(belt) {
  const sys = BELT_SYSTEMS[belt?.system]
  if (!sys) return 'Sin cinturón'
  const b = sys.belts[belt.index]
  if (!belt.stripes) return b.name
  return `${b.name} · ${belt.stripes} grado${belt.stripes > 1 ? 's' : ''}`
}

// next stripe, or next belt with 0 stripes; null at the top
export function nextRank(belt) {
  const sys = BELT_SYSTEMS[belt?.system]
  if (!sys) return null
  if (belt.stripes < sys.maxStripes) return { ...belt, stripes: belt.stripes + 1 }
  if (belt.index < sys.belts.length - 1) return { ...belt, index: belt.index + 1, stripes: 0 }
  return null
}

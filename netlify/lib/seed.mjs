import { hashPassword } from './passwords.mjs'

const DEMO_PASSWORD = hashPassword('demo1234') // every demo account uses this password
const slug = (name) => name.split(' ')[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---------- academies (generic names for the demo) ----------
const academies = [
  { id: 'dojo1', name: 'Dojo1' },
  { id: 'dojo2', name: 'Dojo2' },
  { id: 'dojo3', name: 'Dojo3' },
]

// ---------- groups (one per kind of class, per academy) ----------
// Dojo1 ids have no prefix (kept from the first version); the others use "<academy>:<group>"
const groups = [
  { id: 'kids',      academyId: 'dojo1', name: 'Jiujitsu Kids' },
  { id: 'intro',     academyId: 'dojo1', name: 'Jiujitsu Introducción' },
  { id: 'bjj',       academyId: 'dojo1', name: 'Jiujitsu' },
  { id: 'grappling', academyId: 'dojo1', name: 'Grappling' },
  { id: 'libre',     academyId: 'dojo1', name: 'Open mat' },
  { id: 'dojo2:bjj',  academyId: 'dojo2', name: 'Jiujitsu' },
  { id: 'dojo2:kids', academyId: 'dojo2', name: 'Jiujitsu Kids' },
  { id: 'dojo3:bjj',      academyId: 'dojo3', name: 'Jiujitsu' },
  { id: 'dojo3:nogi',     academyId: 'dojo3', name: 'No-Gi' },
]
const groupOf = (id) => groups.find((g) => g.id === id)

// ---------- timetables ----------
const T = (h, m = 0) => h * 60 + m
// [groupId, weekday (1 = Monday ... 7 = Sunday), start, end]
const TIMETABLE = [
  // Dojo1 (durations assumed 1 h)
  ['bjj',       1, T(10),    T(11)],
  ['bjj',       3, T(10),    T(11)],
  ['bjj',       5, T(10),    T(11)],
  ['grappling', 2, T(9, 30), T(10, 30)],
  ['grappling', 4, T(9, 30), T(10, 30)],
  ['libre',     6, T(10),    T(11)],
  ['kids',      2, T(18),    T(19)],
  ['kids',      4, T(18),    T(19)],
  ['intro',     2, T(19),    T(20)],
  ['intro',     4, T(19),    T(20)],
  ['bjj',       5, T(19),    T(20)],
  ['grappling', 2, T(20),    T(21)],
  ['grappling', 4, T(20),    T(21)],
  ['grappling', 5, T(20),    T(21)],
  ['bjj',       1, T(21),    T(22)],
  ['bjj',       3, T(21),    T(22)],
  // Dojo2 (invented)
  ['dojo2:bjj',  1, T(20), T(21, 30)],
  ['dojo2:bjj',  3, T(20), T(21, 30)],
  ['dojo2:kids', 2, T(18), T(19)],
  ['dojo2:kids', 4, T(18), T(19)],
  // Dojo3 (invented)
  ['dojo3:bjj',  2, T(19), T(20, 30)],
  ['dojo3:bjj',  4, T(19), T(20, 30)],
  ['dojo3:nogi', 5, T(19), T(20)],
]

const classes = TIMETABLE.map(([groupId, weekday, start, end]) => ({
  id: `${groupId}-${weekday}-${start}`,
  academyId: groupOf(groupId).academyId,
  groupId,
  name: groupOf(groupId).name,
  weekday,
  start,
  end,
}))

// ---------- accounts ----------
// superadmin: creates academies; doesn't belong to any of them
const superadmins = [
  { id: 'sa1', name: 'Admin', username: 'admin', email: 'admin@demo.dojo', passwordHash: DEMO_PASSWORD, photo: null },
]

// access: extra dojos a teacher may enter (granted by that dojo's admin after a request)
const teachers = [
  { id: 't1', academyId: 'dojo1', name: 'sensei', username: 'sensei', email: 'sensei@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['bjj', 'grappling', 'libre'], isAdmin: true, access: [] },
  { id: 't2', academyId: 'dojo1', name: 'profe1', username: 'profe1', email: 'profe1@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['kids', 'intro'], isAdmin: false, access: [] },
  { id: 'd2t1', academyId: 'dojo2', name: 'sensei2', username: 'sensei2', email: 'sensei2@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['dojo2:bjj', 'dojo2:kids'], isAdmin: true, access: [] },
  { id: 'd3t1', academyId: 'dojo3', name: 'sensei3', username: 'sensei3', email: 'sensei3@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['dojo3:bjj', 'dojo3:nogi'], isAdmin: true, access: [] },
]

// ---------- students (demo) ----------
const A = 'bjj-adult', K = 'bjj-kids'
// [id, name, academy, groups, attendance probability, [belt system, belt index, stripes]]
const PEOPLE = [
  ['s1',   'Laia Puig',     'dojo1', ['bjj', 'grappling', 'libre'], 0.92, [A, 1, 3]],
  ['s2',   'Marc Soler',    'dojo1', ['intro'],                     0.80, [A, 0, 2]],
  ['s3',   'Nuria Vidal',   'dojo1', ['bjj', 'grappling'],          0.75, [A, 2, 0]],
  ['s4',   'Jordi Ferrer',  'dojo1', ['bjj', 'libre'],              0.88, [A, 3, 1]],
  ['s5',   'Aitana Ruiz',   'dojo1', ['intro'],                     0.40, [A, 0, 0]],
  ['s6',   'Pau Martí',     'dojo1', ['bjj', 'grappling'],          0.66, [A, 1, 1]],
  ['s7',   'Sofía Navarro', 'dojo1', ['intro', 'libre'],            0.95, [A, 0, 4]],
  ['s8',   'Iker López',    'dojo1', ['grappling'],                 0.52, [A, 2, 2]],
  ['s9',   'Clara Roca',    'dojo1', ['intro'],                     0.30, [A, 0, 1]],
  ['s10',  'Hugo Serra',    'dojo1', ['bjj', 'grappling', 'libre'], 0.70, [A, 1, 0]],
  ['s11',  'Bruno Gil',     'dojo1', ['kids'],                      0.85, [K, 2, 1]],
  ['s12',  'Emma Costa',    'dojo1', ['kids'],                      0.78, [K, 1, 3]],
  ['s13',  'Leo Pons',      'dojo1', ['kids'],                      0.60, [K, 0, 2]],
  ['d2s1', 'Oriol Mas',     'dojo2', ['dojo2:bjj'],                 0.85, [A, 1, 2]],
  ['d2s2', 'Júlia Font',    'dojo2', ['dojo2:bjj'],                 0.70, [A, 0, 3]],
  ['d2s3', 'Arnau Vila',    'dojo2', ['dojo2:kids'],                0.80, [K, 1, 1]],
  ['d3s1', 'Marta Bosch',   'dojo3', ['dojo3:bjj', 'dojo3:nogi'],   0.90, [A, 2, 1]],
  ['d3s2', 'Àlex Riera',    'dojo3', ['dojo3:bjj'],                 0.65, [A, 0, 2]],
]

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const PROMOTED = [26, 10, 14, 20, 12, 9, 25, 16, 11, 8, 27, 12, 15, 18, 6, 13, 19, 7]
const BELT_SINCE = [800, 300, 600, 420, 40, 760, 330, 500, 120, 200, 260, 150, 90, 400, 180, 200, 650, 210]

const students = PEOPLE.map(([id, name, academyId, groupIds, , [system, index, stripes]], i) => ({
  id,
  academyId,
  name,
  username: slug(name),
  email: `${slug(name)}@demo.dojo`,
  passwordHash: DEMO_PASSWORD,
  photo: null, // demo accounts show initials; real students upload a photo when registering
  groupIds,
  belt: { system, index, stripes },
  promotedAt: daysAgo(PROMOTED[i] ?? 14), // last stripe or belt
  beltSince: daysAgo(BELT_SINCE[i] ?? 365), // date of current belt
  createdAt: daysAgo(60),
}))

// ---------- 4 weeks of fake history ----------
let r = 42
const rand = () => (r = (r * 16807) % 2147483647) / 2147483647

function pastAttendance() {
  const out = []
  for (let back = 1; back <= 28; back++) {
    const d = new Date(Date.now() - back * 864e5)
    const wd = ((d.getUTCDay() + 6) % 7) + 1
    for (const c of classes.filter((c) => c.weekday === wd)) {
      for (const [id, , , g, p] of PEOPLE) {
        if (g.includes(c.groupId)) out.push({ classId: c.id, date: daysAgo(back), studentId: id, present: rand() < p, by: 'seed' })
      }
    }
  }
  return out
}

const attendance = pastAttendance()

// one example request: Aitana says she came to a class where she's marked absent
const missed = attendance
  .filter((a) => a.studentId === 's5' && !a.present)
  .sort((a, b) => b.date.localeCompare(a.date))[0]
const requests = missed
  ? [{ id: 'r1', studentId: 's5', classId: missed.classId, date: missed.date,
      note: 'Vine a esta clase pero creo que no me marcaste', status: 'pending', createdAt: new Date().toISOString() }]
  : []

export const seed = {
  academies, groups, classes, superadmins, teachers, students, requests, attendance,
  promotions: [], accessRequests: [],
}
import { hashPassword } from './passwords.mjs'

const DEMO_PASSWORD = hashPassword('demo1234') // every demo account uses this password
const slug = (name) => name.split(' ')[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---------- groups (one per kind of class) ----------
const groups = [
  { id: 'kids',      name: 'Jiujitsu Kids' },
  { id: 'intro',     name: 'Jiujitsu Introducción' },
  { id: 'bjj',       name: 'Jiujitsu' },
  { id: 'grappling', name: 'Grappling' },
  { id: 'libre',     name: 'Open mat' },
]
const groupName = (id) => groups.find((g) => g.id === id).name

// ---------- real timetable (BJJ + grappling) ----------
const T = (h, m = 0) => h * 60 + m
// [groupId, weekday (1 = Monday ... 7 = Sunday), start, end]. Durations assumed 1 h; confirm with sensei.
const TIMETABLE = [
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
]

const classes = TIMETABLE.map(([groupId, weekday, start, end]) => ({
  id: `${groupId}-${weekday}-${start}`, groupId, name: groupName(groupId), weekday, start, end,
}))

// ---------- teachers (demo) ----------
const teachers = [
  { id: 't1', name: 'sensei', username: 'sensei', email: 'sensei@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['bjj', 'grappling', 'libre'], isAdmin: true },
  { id: 't2', name: 'profe1', username: 'profe1', email: 'profe1@demo.dojo', passwordHash: DEMO_PASSWORD,
    photo: null, groupIds: ['kids', 'intro'], isAdmin: false },
]

// ---------- students (demo) ----------
const A = 'bjj-adult', K = 'bjj-kids'
// [name, groups, attendance probability, [belt system, belt index, stripes]]
const PEOPLE = [
  ['Laia Puig',     ['bjj', 'grappling', 'libre'], 0.92, [A, 1, 3]],
  ['Marc Soler',    ['intro'],                     0.80, [A, 0, 2]],
  ['Nuria Vidal',   ['bjj', 'grappling'],          0.75, [A, 2, 0]],
  ['Jordi Ferrer',  ['bjj', 'libre'],              0.88, [A, 3, 1]],
  ['Aitana Ruiz',   ['intro'],                     0.40, [A, 0, 0]],
  ['Pau Martí',     ['bjj', 'grappling'],          0.66, [A, 1, 1]],
  ['Sofía Navarro', ['intro', 'libre'],            0.95, [A, 0, 4]],
  ['Iker López',    ['grappling'],                 0.52, [A, 2, 2]],
  ['Clara Roca',    ['intro'],                     0.30, [A, 0, 1]],
  ['Hugo Serra',    ['bjj', 'grappling', 'libre'], 0.70, [A, 1, 0]],
  ['Bruno Gil',     ['kids'],                      0.85, [K, 2, 1]],
  ['Emma Costa',    ['kids'],                      0.78, [K, 1, 3]],
  ['Leo Pons',      ['kids'],                      0.60, [K, 0, 2]],
]

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)

const students = PEOPLE.map(([name, groupIds, , [system, index, stripes]], i) => ({
  id: `s${i + 1}`,
  name,
  username: slug(name),
  email: `${slug(name)}@demo.dojo`,
  passwordHash: DEMO_PASSWORD,
  photo: null, // demo accounts show initials; real students upload a photo when registering
  groupIds,
  belt: { system, index, stripes },
  promotedAt: daysAgo([26, 10, 14, 20, 12, 9, 25, 16, 11, 8, 27, 12, 15][i] ?? 14), // last stripe or belt
  beltSince: daysAgo([800, 300, 600, 420, 40, 760, 330, 500, 120, 200, 260, 150, 90][i] ?? 365), // date of current belt
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
      PEOPLE.forEach(([, g, p], i) => {
        if (g.includes(c.groupId)) {
          out.push({ classId: c.id, date: daysAgo(back), studentId: `s${i + 1}`, present: rand() < p, by: 't1' })
        }
      })
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

export const seed = { groups, classes, teachers, students, requests, attendance, promotions: [] }
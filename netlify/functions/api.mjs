import { getStore } from '@netlify/blobs'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { seed } from '../lib/seed.mjs'
import { hashPassword, checkPassword } from '../lib/passwords.mjs'
import { BELT_SYSTEMS, beltInfo, nextRank, rankProgress } from '../../shared/belts.js'

const REQUEST_WINDOW_DAYS = 14    // students can ask about classes up to 2 weeks back
const ATTENDANCE_WINDOW_DAYS = 30 // teachers can take or correct attendance up to 30 days back
const STORE_NAME = 'dojo-v3'

// ---------- storage (Netlify Blobs; in-memory when DOJO_MEMORY_STORE=1, for tests) ----------
const memory = new Map()
const store = () =>
  process.env.DOJO_MEMORY_STORE === '1'
    ? {
        get: async (k) => (memory.has(k) ? structuredClone(memory.get(k)) : null),
        setJSON: async (k, v) => { memory.set(k, structuredClone(v)) },
        delete: async (k) => { memory.delete(k) },
      }
    : getStore({ name: STORE_NAME, consistency: 'strong' })

async function load() {
  const db = await store().get('db', { type: 'json' })
  if (!db) {
    await store().setJSON('db', seed)
    return structuredClone(seed)
  }
  if (migrate(db)) await store().setJSON('db', db)
  return db
}

// One-off fixes for data saved by older versions. Safe to run on every request: does nothing once applied.
function migrate(db) {
  let changed = false
  // v4: the always-open demo class is gone; open mat is only Saturday 10:00 ("libre" group)
  if (db.groups.some((g) => g.id === 'demo')) {
    const isDemo = (classId) => String(classId).startsWith('demo-')
    db.groups = db.groups.filter((g) => g.id !== 'demo')
    db.classes = db.classes.filter((c) => c.groupId !== 'demo')
    db.attendance = db.attendance.filter((a) => !isDemo(a.classId))
    db.requests = db.requests.filter((r) => !isDemo(r.classId))
    for (const u of [...db.students, ...db.teachers]) u.groupIds = u.groupIds.filter((g) => g !== 'demo')
    changed = true
  }
  const libre = db.groups.find((g) => g.id === 'libre')
  if (libre && libre.name === 'Clase libre') {
    libre.name = 'Open mat'
    for (const c of db.classes) if (c.groupId === 'libre') c.name = 'Open mat'
    changed = true
  }
  // v5: several academies. Everything that existed until now belongs to the first dojo; add the superadmin account.
  if (!db.academies) {
    db.academies = [{ id: 'ksk', name: 'KSK' }]
    for (const list of [db.groups, db.classes, db.teachers, db.students]) {
      for (const x of list) x.academyId ??= 'ksk'
    }
    db.superadmins ??= structuredClone(seed.superadmins)
    changed = true
  }
  // v6: generic names for the demo. The first dojo becomes Dojo1; demo Dojo2 and Dojo3 are added if missing
  if (db.academies.some((a) => a.id === 'ksk')) {
    for (const a of db.academies) if (a.id === 'ksk') Object.assign(a, { id: 'dojo1', name: 'Dojo1' })
    for (const list of [db.groups, db.classes, db.teachers, db.students]) {
      for (const x of list) if (x.academyId === 'ksk') x.academyId = 'dojo1'
    }
    changed = true
  }
  if (!db.accessRequests) { db.accessRequests = []; changed = true }
  for (const extra of ['dojo2', 'dojo3']) {
    if (db.academies.some((a) => a.id === extra)) continue
    const taken = new Set(allAccounts(db).flatMap((u) => [u.id, u.username, u.email]))
    const free = (u) => ![u.id, u.username, u.email].some((k) => taken.has(k))
    const mine = (x) => x.academyId === extra
    const newStudents = seed.students.filter((s) => mine(s) && free(s))
    const ids = new Set(newStudents.map((s) => s.id))
    db.academies.push(structuredClone(seed.academies.find((a) => a.id === extra)))
    db.groups.push(...structuredClone(seed.groups.filter(mine)))
    db.classes.push(...structuredClone(seed.classes.filter(mine)))
    db.teachers.push(...structuredClone(seed.teachers.filter((t) => mine(t) && free(t))))
    db.students.push(...structuredClone(newStudents))
    db.attendance.push(...structuredClone(seed.attendance.filter((a) => ids.has(a.studentId))))
    changed = true
  }
  return changed
}
const save = (db) => store().setJSON('db', db)
const json = (data, status = 200) => Response.json(data, { status })
const fail = (message, status = 400) => json({ message }, status)
const pub = ({ passwordHash, ...p }) => p // never send password hashes

// ---------- tokens ----------
const hmac = (body) =>
  createHmac('sha256', process.env.TOKEN_SECRET || 'dev-secret-change-me').update(body).digest('base64url')

function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 3600e3 })).toString('base64url')
  return `${body}.${hmac(body)}`
}

function readToken(req) {
  try {
    const [body, sig] = (req.headers.get('authorization') || '').replace(/^Bearer /, '').split('.')
    if (!body || !sig) return null
    const expected = hmac(body)
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() ? p : null
  } catch {
    return null
  }
}

// ---------- dates (dojo time) ----------
function madridNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday],
    minutes: Number(p.hour) * 60 + Number(p.minute),
  }
}
const shiftDate = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isoWeekday = (iso) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1
// "19:30" -> 1170 minutes; null if invalid
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ''))
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// ---------- text ----------
const norm = (s) => String(s ?? '').trim().toLowerCase()
const fold = (s) => norm(s).normalize('NFD').replace(/\p{Diacritic}/gu, '')
const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---------- accounts ----------
const USERNAME = /^[a-z0-9._-]{3,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const validPhoto = (p) => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 400_000
const allAccounts = (db) => [...db.students, ...db.teachers, ...(db.superadmins ?? [])]

function validateAccount(db, b, { selfId = null, requirePassword = false } = {}) {
  if (!String(b.name ?? '').trim()) return 'Falta el nombre'
  const username = norm(b.username)
  const email = norm(b.email)
  if (!USERNAME.test(username)) return 'Usuario: de 3 a 20 caracteres (minúsculas, números, punto, guion)'
  if (!EMAIL.test(email)) return 'Email no válido'
  const clash = allAccounts(db).find((u) => u.id !== selfId && (u.username === username || u.email === email))
  if (clash) return clash.username === username ? 'Ese nombre de usuario ya existe' : 'Ese email ya está registrado'
  if ((requirePassword || b.password) && String(b.password ?? '').length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  return null
}

// ---------- domain ----------
const academyName = (db, id) => db.academies.find((a) => a.id === id)?.name ?? ''
const activeClasses = (db) => db.classes.filter((c) => !c.archived)
const academyGroupIds = (db, academyId) => db.groups.filter((g) => g.academyId === academyId).map((g) => g.id)
// groups a teacher works with: all of their academy if admin, otherwise the ones assigned
const scopeOf = (db, t) => (t.isAdmin ? academyGroupIds(db, t.academyId) : t.groupIds)
// a teacher manages a student if they are in the same academy and share a group
const inScope = (t, gids, s) => s.academyId === t.academyId && s.groupIds.some((g) => gids.includes(g))
const className = (db, id) => db.classes.find((c) => c.id === id)?.name

// A teacher belongs to their own dojo and may have been given access to others (teacher or admin there)
const membershipsOf = (t) => [
  { academyId: t.academyId, isAdmin: !!t.isAdmin, groupIds: t.groupIds },
  ...(t.access ?? []),
]
// the teacher as seen inside one dojo; null if they have no access to it
const asMember = (t, academyId) => {
  const m = membershipsOf(t).find((x) => x.academyId === (academyId ?? t.academyId))
  return m ? { ...t, ...m, homeAcademyId: t.academyId } : null
}
const teacherSession = (db, t, academyId) => {
  const m = asMember(t, academyId)
  return {
    token: sign({ role: 'teacher', id: t.id, academyId: m.academyId }),
    user: {
      id: t.id, name: t.name, role: 'teacher', isAdmin: m.isAdmin, academyId: m.academyId,
      academies: membershipsOf(t).map((x) => ({ id: x.academyId, name: academyName(db, x.academyId), isAdmin: x.isAdmin })),
    },
  }
}
const outLabel = (r) => `Entreno fuera · ${r.place}`

function validBelt(belt) {
  const sys = BELT_SYSTEMS[belt?.system]
  if (!sys || !Number.isInteger(belt.index) || belt.index < 0 || belt.index >= sys.belts.length) return false
  return Number.isInteger(belt.stripes) && belt.stripes >= 0 && belt.stripes <= sys.belts[belt.index].maxStripes
}
const sameBelt = (a, b) => a?.system === b?.system && a?.index === b?.index && a?.stripes === b?.stripes
const defaultBelt = (groupNames) => ({
  system: groupNames.some((n) => /kids|infantil|niñ/i.test(n)) ? 'bjj-kids' : 'bjj-adult', index: 0, stripes: 0,
})

function beltProgress(db, s) {
  if (!beltInfo(s.belt)) return null
  // counts classes in any academy (guest visits and approved "trained out" included)
  const attended = db.attendance
    .filter((a) => a.studentId === s.id && a.present && a.date > (s.promotedAt ?? '')).length
  return rankProgress(s.belt, {
    attended,
    beltSince: s.beltSince ?? s.createdAt ?? s.promotedAt, // older records have no beltSince
    promotedAt: s.promotedAt,
    today: madridNow().date,
  })
}

function attendanceRate(db, id) {
  const mine = db.attendance.filter((a) => a.studentId === id)
  return mine.length ? mine.filter((a) => a.present).length / mine.length : 0
}

const studentView = (db, s) => ({
  ...pub(s), academyName: academyName(db, s.academyId), progress: beltProgress(db, s), rate: attendanceRate(db, s.id),
})
// what another academy may see of a visiting student
const guestView = (db, s) => ({
  id: s.id, name: s.name, photo: s.photo, belt: s.belt, groupIds: [], guest: true,
  academyId: s.academyId, academyName: academyName(db, s.academyId), rate: 0,
})

// Classes of the student's groups in the last 14 days, already started,
// where they are NOT marked present and have no pending request
function requestableSessions(db, s, now) {
  const out = []
  for (let back = 0; back <= REQUEST_WINDOW_DAYS; back++) {
    const date = shiftDate(now.date, -back)
    const wd = isoWeekday(date)
    for (const c of activeClasses(db)) {
      if (c.weekday !== wd || !s.groupIds.includes(c.groupId)) continue
      if (back === 0 && c.start > now.minutes) continue
      const present = db.attendance.some((a) => a.studentId === s.id && a.classId === c.id && a.date === date && a.present)
      const pending = db.requests.some((r) => r.studentId === s.id && r.classId === c.id && r.date === date && r.status === 'pending')
      if (!present && !pending) out.push({ classId: c.id, date, name: c.name, start: c.start })
    }
  }
  return out
}

// ---------- routes ----------
export default async (req) => {
  const url = new URL(req.url)
  const [resource, id, action] = url.pathname.replace(/^\/api\/?/, '').split('/').map(decodeURIComponent)
  const method = req.method
  const body = ['POST', 'PUT'].includes(method) ? await req.json().catch(() => ({})) : {}
  const auth = readToken(req)
  const db = await load()
  const now = madridNow()

  // ===== public =====
  if (method === 'GET' && resource === 'academies') {
    return json(db.academies.map(({ id, name }) => ({ id, name })))
  }

  if (method === 'GET' && resource === 'groups') {
    const academyId = url.searchParams.get('academy')
    return json(db.groups.filter((g) => g.academyId === academyId).map(({ id, name }) => ({ id, name })))
  }

  if (method === 'POST' && resource === 'register') {
    const err = validateAccount(db, body, { requirePassword: true })
    if (err) return fail(err, 422)
    if (body.password !== body.passwordConfirmation) return fail('Las contraseñas no coinciden', 422)
    if (!validPhoto(body.photo)) return fail('Sube una foto tuya (JPG o PNG)', 422)
    const academy = db.academies.find((a) => a.id === body.academyId)
    if (!academy) return fail('Elige tu academia', 422)
    const allowed = academyGroupIds(db, academy.id)
    const groupIds = (Array.isArray(body.groupIds) ? body.groupIds : []).filter((g) => allowed.includes(g))
    if (!groupIds.length) return fail('Elige al menos una clase', 422)
    if (body.consent !== true) return fail('Falta aceptar el tratamiento de datos', 422)

    const groupNames = db.groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name)
    db.students.push({
      id: crypto.randomUUID(),
      academyId: academy.id,
      name: String(body.name).trim(),
      username: norm(body.username),
      email: norm(body.email),
      passwordHash: hashPassword(body.password),
      photo: body.photo,
      groupIds,
      belt: defaultBelt(groupNames),
      promotedAt: now.date,
      beltSince: now.date,
      createdAt: now.date,
    })
    await save(db)
    return json({ message: 'Cuenta creada. Ya puedes iniciar sesión.' }, 201)
  }

  if (method === 'POST' && resource === 'login') {
    const who = norm(body.identifier)
    const match = (u) => u.username === who || u.email === who
    const found =
      [['superadmin', db.superadmins ?? []], ['teacher', db.teachers], ['student', db.students]]
        .map(([role, list]) => [role, list.find(match)])
        .find(([, u]) => u)
    const [role, user] = found ?? []
    if (!user || !checkPassword(body.password, user.passwordHash)) return fail('Usuario o contraseña incorrectos', 401)
    if (role === 'teacher') return json(teacherSession(db, user, user.academyId))
    return json({
      token: sign({ role, id: user.id }),
      user: { id: user.id, name: user.name, role, isAdmin: !!user.isAdmin, academyId: user.academyId ?? null },
    })
  }

  // ===== own profile (everyone) =====
  if (resource === 'profile') {
    const lists = { teacher: db.teachers, student: db.students, superadmin: db.superadmins ?? [] }
    const list = lists[auth?.role] ?? null
    const i = list ? list.findIndex((u) => u.id === auth.id) : -1
    if (i < 0) return fail('Sesión caducada, vuelve a entrar', 401)
    const u = list[i]

    if (method === 'GET') return json(pub(u))

    if (method === 'PUT') {
      const next = { ...u }
      if (body.name !== undefined) {
        if (!String(body.name).trim()) return fail('Falta el nombre', 422)
        next.name = String(body.name).trim()
      }
      if (body.photo !== undefined && body.photo !== u.photo) {
        if (!validPhoto(body.photo)) return fail('Foto no válida', 422)
        next.photo = body.photo
      }
      if (body.newPassword) {
        if (!checkPassword(body.currentPassword, u.passwordHash)) return fail('La contraseña actual no es correcta', 422)
        if (String(body.newPassword).length < 8) return fail('La nueva contraseña debe tener al menos 8 caracteres', 422)
        next.passwordHash = hashPassword(body.newPassword)
      }
      list[i] = next
      await save(db)
      return json(pub(next))
    }
  }

  // ===== superadmin: academies =====
  if (resource === 'admin') {
    const sa = auth?.role === 'superadmin' && (db.superadmins ?? []).find((x) => x.id === auth.id)
    if (!sa) return fail('Solo para el superadministrador', 401)

    if (method === 'GET' && id === 'academies') {
      return json(db.academies.map((a) => ({
        ...a,
        teachers: db.teachers.filter((t) => t.academyId === a.id).length,
        students: db.students.filter((s) => s.academyId === a.id).length,
        classes: activeClasses(db).filter((c) => c.academyId === a.id).length,
        admins: db.teachers.filter((t) => t.academyId === a.id && t.isAdmin).map((t) => ({ name: t.name, username: t.username })),
      })))
    }

    // new academy + its class groups + its first sensei (admin)
    if (method === 'POST' && id === 'academies') {
      const name = String(body.name ?? '').trim()
      if (!name) return fail('Falta el nombre de la academia', 422)
      const academyId = slugify(body.slug || name)
      if (!academyId) return fail('Identificador no válido', 422)
      if (db.academies.some((a) => a.id === academyId)) return fail('Ya existe una academia con ese identificador', 422)
      const groupNames = [...new Set((Array.isArray(body.groups) ? body.groups : []).map((g) => String(g).trim()).filter(Boolean))]
      if (!groupNames.length) return fail('Añade al menos un grupo de clases', 422)
      const admin = body.admin ?? {}
      const err = validateAccount(db, admin, { requirePassword: true })
      if (err) return fail(`Sensei: ${err}`, 422)

      const newGroups = groupNames.map((n) => ({ id: `${academyId}:${slugify(n)}`, academyId, name: n }))
      db.academies.push({ id: academyId, name })
      db.groups.push(...newGroups)
      db.teachers.push({
        id: crypto.randomUUID(), academyId,
        name: String(admin.name).trim(), username: norm(admin.username), email: norm(admin.email),
        passwordHash: hashPassword(admin.password), photo: null,
        groupIds: newGroups.map((g) => g.id), isAdmin: true,
      })
      await save(db)
      return json({ id: academyId, name }, 201)
    }

    if (method === 'POST' && id === 'reset') {
      await store().delete('db')
      return json({ message: 'Datos reiniciados' })
    }

    return fail('Ruta no encontrada', 404)
  }

  // ===== student =====
  if (resource === 'me' || (resource === 'requests' && auth?.role !== 'teacher')) {
    const s = auth?.role === 'student' && db.students.find((x) => x.id === auth.id)
    if (!s) return fail('Sesión caducada, vuelve a entrar', 401)

    if (method === 'GET' && resource === 'me') {
      return json({
        student: studentView(db, s),
        history: db.attendance
          .filter((a) => a.studentId === s.id && a.present)
          .map((a) => {
            if (a.out) return { date: a.date, className: 'Entreno fuera', visit: a.place }
            const c = db.classes.find((x) => x.id === a.classId)
            const visit = c && c.academyId !== s.academyId ? academyName(db, c.academyId) : null
            return { date: a.date, className: c?.name, visit }
          })
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 15),
        sessions: requestableSessions(db, s, now),
        requests: db.requests
          .filter((r) => r.studentId === s.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10)
          .map((r) => ({ ...r, className: r.out ? outLabel(r) : className(db, r.classId) })),
        promotions: db.promotions.filter((p) => p.studentId === s.id),
      })
    }

    // "I trained out": the student had to train in another dojo (one of the app's or any other place)
    if (method === 'POST' && resource === 'requests' && !id && body.out) {
      const date = String(body.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > now.date || date < shiftDate(now.date, -REQUEST_WINDOW_DAYS)) {
        return fail(`Fecha no válida: de hoy a ${REQUEST_WINDOW_DAYS} días atrás`, 422)
      }
      const academy = body.academyId ? db.academies.find((a) => a.id === body.academyId && a.id !== s.academyId) : null
      if (body.academyId && !academy) return fail('Dojo no válido', 422)
      const place = academy?.name ?? String(body.place ?? '').trim().slice(0, 80)
      if (!place) return fail('Indica dónde entrenaste', 422)
      const dup = db.requests.some((r) => r.studentId === s.id && r.out && r.date === date && r.status === 'pending')
        || db.attendance.some((a) => a.studentId === s.id && a.out && a.date === date)
      if (dup) return fail('Ese día ya tiene un entreno fuera registrado o pedido', 422)
      const r = {
        id: crypto.randomUUID(), studentId: s.id, classId: null, out: true, place, placeAcademyId: academy?.id ?? null, date,
        note: String(body.note ?? '').slice(0, 200), status: 'pending', createdAt: new Date().toISOString(),
      }
      db.requests.push(r)
      await save(db)
      return json(r, 201)
    }

    if (method === 'POST' && resource === 'requests' && !id) {
      const ok = requestableSessions(db, s, now).some((x) => x.classId === body.classId && x.date === body.date)
      if (!ok) return fail('No puedes solicitar esa clase (ya consta, ya está pedida o queda fuera de plazo)', 422)
      const r = {
        id: crypto.randomUUID(), studentId: s.id, classId: body.classId, date: body.date,
        note: String(body.note ?? '').slice(0, 200), status: 'pending', createdAt: new Date().toISOString(),
      }
      db.requests.push(r)
      await save(db)
      return json(r, 201)
    }
  }

  // ===== teacher (always inside one dojo: their own, or one they were given access to) =====
  if (['teacher', 'attendance', 'students', 'teachers', 'requests', 'classes', 'groups', 'guests', 'access'].includes(resource)) {
    const base = auth?.role === 'teacher' && db.teachers.find((x) => x.id === auth.id)
    if (!base) return fail('Solo para profesores', 401)
    const t = asMember(base, auth.academyId) // the teacher inside the dojo they are working in now
    if (!t) return fail('Ya no tienes acceso a ese dojo, vuelve a entrar', 401)
    const gids = scopeOf(db, t)
    const admin = !!t.isAdmin
    // pending requests this teacher handles: classes of their groups, and "trained out" of their students
    const myRequest = (r) => r.out
      ? inScope(t, gids, db.students.find((s) => s.id === r.studentId) ?? {})
      : gids.includes(db.classes.find((c) => c.id === r.classId)?.groupId)

    // move to another dojo this teacher has access to
    if (method === 'POST' && resource === 'teacher' && id === 'switch') {
      if (!asMember(base, body.academyId)) return fail('No tienes acceso a ese dojo', 403)
      return json(teacherSession(db, base, body.academyId))
    }

    if (method === 'GET' && resource === 'teacher' && id === 'state') {
      const classes = activeClasses(db).filter((c) => gids.includes(c.groupId))
      const classIds = new Set(classes.map((c) => c.id))
      const today = db.attendance.filter((a) => a.date === now.date && classIds.has(a.classId))
      const visitorIds = new Set(today.map((a) => a.studentId))
      return json({
        now,
        me: pub(t),
        academy: db.academies.find((a) => a.id === t.academyId),
        groups: db.groups.filter((g) => gids.includes(g.id)),
        classes,
        students: db.students.filter((s) => inScope(t, gids, s)).map((s) => studentView(db, s)),
        // students from elsewhere marked in my classes today
        guests: db.students.filter((s) => visitorIds.has(s.id) && !inScope(t, gids, s)).map((s) => guestView(db, s)),
        attendance: today,
        requests: db.requests
          .filter((r) => r.status === 'pending' && myRequest(r))
          .map((r) => (r.out ? { ...r, className: outLabel(r) } : r)),
        accessPending: admin ? db.accessRequests.filter((r) => r.academyId === t.academyId && r.status === 'pending').length : 0,
        ...(admin ? {
          teachers: db.teachers.filter((x) => x.academyId === t.academyId).map(pub),
          allGroups: db.groups.filter((g) => g.academyId === t.academyId),
          allClasses: activeClasses(db).filter((c) => c.academyId === t.academyId),
        } : {}),
      })
    }

    // search students from other academies (or not in my groups) to add as guests
    if (method === 'GET' && resource === 'guests') {
      const q = fold(url.searchParams.get('q'))
      if (q.length < 2) return json([])
      return json(db.students
        .filter((s) => !inScope(t, gids, s) && (fold(s.name).includes(q) || s.username.includes(q)))
        .slice(0, 10)
        .map((s) => guestView(db, s)))
    }

    // Attendance of one day (today or a past day) for the teacher's classes, to browse the calendar
    if (method === 'GET' && resource === 'attendance' && !id) {
      const date = url.searchParams.get('date') ?? now.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > now.date || date < shiftDate(now.date, -ATTENDANCE_WINDOW_DAYS)) {
        return fail(`Solo se pueden consultar los últimos ${ATTENDANCE_WINDOW_DAYS} días`, 422)
      }
      const classIds = new Set(activeClasses(db).filter((c) => gids.includes(c.groupId)).map((c) => c.id))
      const attendance = db.attendance.filter((a) => a.date === date && classIds.has(a.classId))
      const visitorIds = new Set(attendance.map((a) => a.studentId))
      return json({
        date,
        attendance,
        guests: db.students.filter((s) => visitorIds.has(s.id) && !inScope(t, gids, s)).map((s) => guestView(db, s)),
      })
    }

    // Teacher records attendance for one class: today or a past day (also how offline saves arrive late)
    if (method === 'PUT' && resource === 'attendance' && id) {
      const cls = activeClasses(db).find((c) => c.id === id)
      if (!cls || !gids.includes(cls.groupId)) return fail('Esa clase no es de tus grupos', 403)
      const date = body.date ?? now.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > now.date || date < shiftDate(now.date, -ATTENDANCE_WINDOW_DAYS)) {
        return fail(`Fecha no válida: se puede pasar lista de hoy y de los últimos ${ATTENDANCE_WINDOW_DAYS} días`, 422)
      }
      if (isoWeekday(date) !== cls.weekday) return fail('Esa clase no se imparte ese día', 422)
      const marks = body.marks ?? {}
      const known = new Set(db.students.map((s) => s.id)) // own students and guests from any academy
      db.attendance = db.attendance.filter((a) => !(a.classId === id && a.date === date))
      for (const [studentId, present] of Object.entries(marks)) {
        if (known.has(studentId)) db.attendance.push({ classId: id, date, studentId, present: !!present, by: t.id })
      }
      // a pending request for this class/day is approved automatically if the teacher marked them present
      for (const r of db.requests) {
        if (r.status === 'pending' && r.classId === id && r.date === date && marks[r.studentId]) {
          Object.assign(r, { status: 'approved', resolvedBy: t.id, resolvedAt: new Date().toISOString() })
        }
      }
      await save(db)
      return json({ message: 'Asistencia guardada' })
    }

    // Teacher resolves a student's request
    if (method === 'POST' && resource === 'requests' && id && ['approve', 'reject'].includes(action)) {
      const r = db.requests.find((x) => x.id === id)
      if (!r || !myRequest(r)) return fail('Solicitud no encontrada', 404)
      if (r.status !== 'pending') return fail('Esta solicitud ya está resuelta')
      if (action === 'approve' && r.out) {
        // counts as a class for the belt, like any other
        db.attendance.push({ classId: null, out: true, place: r.place, date: r.date, studentId: r.studentId, present: true, by: t.id })
      } else if (action === 'approve') {
        db.attendance = db.attendance.filter((a) => !(a.studentId === r.studentId && a.classId === r.classId && a.date === r.date))
        db.attendance.push({ classId: r.classId, date: r.date, studentId: r.studentId, present: true, by: t.id })
      }
      Object.assign(r, {
        status: action === 'approve' ? 'approved' : 'rejected',
        reply: String(body.reply ?? '').slice(0, 200),
        resolvedBy: t.id,
        resolvedAt: new Date().toISOString(),
      })
      await save(db)
      return json(r)
    }

    // Students register themselves; teachers edit, set belt, promote, delete
    if (resource === 'students' && id) {
      const i = db.students.findIndex((s) => s.id === id)
      if (i < 0 || !inScope(t, gids, db.students[i])) return fail('Alumno no encontrado', 404)
      const s = db.students[i]

      if (method === 'POST' && action === 'promote') {
        const to = nextRank(s.belt)
        if (!to) return fail('Ya tiene el rango máximo')
        db.promotions.push({ studentId: s.id, date: now.date, from: s.belt, to, by: t.id, kind: 'promotion' })
        const beltChanged = to.index !== s.belt.index
        db.students[i] = { ...s, belt: to, promotedAt: now.date, ...(beltChanged ? { beltSince: now.date } : {}) }
        await save(db)
        return json(studentView(db, db.students[i]))
      }

      if (method === 'PUT' && !action) {
        if (!String(body.name ?? '').trim()) return fail('Falta el nombre', 422)
        if (!Array.isArray(body.groupIds) || body.groupIds.some((g) => !gids.includes(g))) {
          return fail('No puedes asignar grupos que no son tuyos', 422)
        }
        const groupIds = [...new Set([...s.groupIds.filter((g) => !gids.includes(g)), ...body.groupIds])]
        if (!groupIds.length) return fail('Elige al menos un grupo', 422)

        let updated = { ...s, name: String(body.name).trim(), groupIds }

        // manual belt correction (e.g. a student who arrives with another belt): logged, resets the class counter
        if (body.belt && !sameBelt(body.belt, s.belt)) {
          if (!validBelt(body.belt)) return fail('Cinturón no válido', 422)
          const belt = { system: body.belt.system, index: body.belt.index, stripes: body.belt.stripes }
          db.promotions.push({ studentId: s.id, date: now.date, from: s.belt, to: belt, by: t.id, kind: 'adjust' })
          const beltChanged = belt.system !== s.belt?.system || belt.index !== s.belt?.index
          updated = { ...updated, belt, promotedAt: now.date, ...(beltChanged ? { beltSince: now.date } : {}) }
        }

        db.students[i] = updated
        await save(db)
        return json(studentView(db, updated))
      }

      if (method === 'DELETE' && !action) {
        db.students.splice(i, 1)
        db.requests = db.requests.filter((r) => r.studentId !== id)
        db.attendance = db.attendance.filter((a) => a.studentId !== id)
        db.promotions = db.promotions.filter((p) => p.studentId !== id)
        await save(db)
        return json({ message: 'Alumno eliminado' })
      }
    }

    // ----- access to other dojos (teachers only) -----
    // A teacher asks to work in another dojo as teacher or admin; that dojo's admin approves or rejects it
    if (resource === 'access') {
      const label = (r) => {
        const who = db.teachers.find((x) => x.id === r.teacherId)
        return { ...r, academyName: academyName(db, r.academyId), teacherName: who?.name, teacherUsername: who?.username,
                 fromAcademy: academyName(db, who?.academyId) }
      }

      if (method === 'GET' && !id) {
        const memberOf = new Set(membershipsOf(base).map((m) => m.academyId))
        const pendingFor = new Set(db.accessRequests.filter((r) => r.teacherId === base.id && r.status === 'pending').map((r) => r.academyId))
        return json({
          academies: db.academies.map(({ id, name }) => ({
            id, name, status: memberOf.has(id) ? 'member' : pendingFor.has(id) ? 'pending' : null,
          })),
          mine: db.accessRequests.filter((r) => r.teacherId === base.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map(label),
          incoming: admin ? db.accessRequests.filter((r) => r.academyId === t.academyId && r.status === 'pending').map(label) : [],
          groups: admin ? db.groups.filter((g) => g.academyId === t.academyId) : [],
          // teachers from other dojos who can work here
          visitors: admin ? db.teachers
            .filter((x) => x.academyId !== t.academyId && (x.access ?? []).some((m) => m.academyId === t.academyId))
            .map((x) => ({ id: x.id, name: x.name, username: x.username, fromAcademy: academyName(db, x.academyId),
                           isAdmin: x.access.find((m) => m.academyId === t.academyId).isAdmin })) : [],
        })
      }

      if (method === 'POST' && !id) {
        const academy = db.academies.find((a) => a.id === body.academyId)
        if (!academy) return fail('Elige un dojo', 422)
        if (!['teacher', 'admin'].includes(body.role)) return fail('Elige el rol: profesor o administrador', 422)
        const current = membershipsOf(base).find((m) => m.academyId === academy.id)
        if (current && (current.isAdmin || body.role === 'teacher')) return fail('Ya tienes ese acceso a este dojo', 422)
        if (db.accessRequests.some((r) => r.teacherId === base.id && r.academyId === academy.id && r.status === 'pending')) {
          return fail('Ya tienes una solicitud pendiente para ese dojo', 422)
        }
        const r = {
          id: crypto.randomUUID(), teacherId: base.id, academyId: academy.id, role: body.role,
          note: String(body.note ?? '').slice(0, 200), status: 'pending', createdAt: new Date().toISOString(),
        }
        db.accessRequests.push(r)
        await save(db)
        return json(label(r), 201)
      }

      if (!admin) return fail('Solo el administrador del dojo gestiona los accesos', 403)

      if (method === 'POST' && id && ['approve', 'reject'].includes(action)) {
        const r = db.accessRequests.find((x) => x.id === id && x.academyId === t.academyId)
        if (!r) return fail('Solicitud no encontrada', 404)
        if (r.status !== 'pending') return fail('Esta solicitud ya está resuelta')
        const who = db.teachers.find((x) => x.id === r.teacherId)
        if (!who) return fail('Ese profesor ya no existe', 404)
        if (action === 'approve') {
          const own = academyGroupIds(db, t.academyId)
          const picked = Array.isArray(body.groupIds) ? body.groupIds.filter((g) => own.includes(g)) : []
          const membership = { academyId: t.academyId, isAdmin: r.role === 'admin', groupIds: r.role === 'admin' || !picked.length ? own : picked }
          if (who.academyId === t.academyId) Object.assign(who, { isAdmin: who.isAdmin || membership.isAdmin })
          else who.access = [...(who.access ?? []).filter((m) => m.academyId !== t.academyId), membership]
        }
        Object.assign(r, { status: action === 'approve' ? 'approved' : 'rejected', resolvedBy: t.id, resolvedAt: new Date().toISOString() })
        await save(db)
        return json(label(r))
      }

      // remove the access of a teacher from another dojo
      if (method === 'DELETE' && id) {
        const who = db.teachers.find((x) => x.id === id && x.academyId !== t.academyId)
        if (!who || !(who.access ?? []).some((m) => m.academyId === t.academyId)) return fail('Profesor no encontrado', 404)
        who.access = who.access.filter((m) => m.academyId !== t.academyId)
        await save(db)
        return json({ message: 'Acceso retirado' })
      }
    }

    // ----- academy admin: timetable and class groups -----
    if (resource === 'groups' || resource === 'classes') {
      if (!admin) return fail('Solo el administrador de la academia gestiona el horario', 403)

      if (resource === 'groups' && method === 'POST' && !id) {
        const name = String(body.name ?? '').trim()
        if (!name) return fail('Falta el nombre del grupo', 422)
        const groupId = `${t.academyId}:${slugify(name)}`
        if (db.groups.some((g) => g.id === groupId)) return fail('Ya existe un grupo con ese nombre', 422)
        const g = { id: groupId, academyId: t.academyId, name }
        db.groups.push(g)
        await save(db)
        return json(g, 201)
      }

      if (resource === 'classes' && method === 'POST' && !id) {
        const g = db.groups.find((x) => x.id === body.groupId && x.academyId === t.academyId)
        if (!g) return fail('Elige un grupo de tu academia', 422)
        const weekday = Number(body.weekday)
        const start = toMinutes(body.start)
        const end = toMinutes(body.end)
        if (!(weekday >= 1 && weekday <= 7)) return fail('Día no válido', 422)
        if (start === null || end === null || end <= start) return fail('Horas no válidas (la clase tiene que acabar después de empezar)', 422)
        const classId = `${g.id}-${weekday}-${start}`
        const existing = db.classes.find((c) => c.id === classId)
        if (existing && !existing.archived) return fail('Ya existe esa clase', 422)
        if (existing) Object.assign(existing, { archived: false, end, name: g.name }) // bring back, history kept
        else db.classes.push({ id: classId, academyId: t.academyId, groupId: g.id, name: g.name, weekday, start, end })
        await save(db)
        return json({ id: classId }, 201)
      }

      // removing a class only hides it from the timetable; past attendance keeps its name
      if (resource === 'classes' && method === 'DELETE' && id) {
        const c = db.classes.find((x) => x.id === id && x.academyId === t.academyId)
        if (!c) return fail('Clase no encontrada', 404)
        c.archived = true
        await save(db)
        return json({ message: 'Clase eliminada del horario' })
      }
    }

    // ----- academy admin: teachers -----
    if (resource === 'teachers') {
      if (!admin) return fail('Solo el administrador gestiona el equipo', 403)
      const own = academyGroupIds(db, t.academyId)
      const check = (b, selfId, isNew) =>
        validateAccount(db, b, { selfId, requirePassword: isNew })
        || (!Array.isArray(b.groupIds) || b.groupIds.some((g) => !own.includes(g)) ? 'Grupos no válidos' : null)
        || (b.photo && !validPhoto(b.photo) ? 'Foto no válida' : null)
      const clean = (b) => ({
        name: String(b.name).trim(),
        username: norm(b.username),
        email: norm(b.email),
        groupIds: b.groupIds,
        isAdmin: !!b.isAdmin,
        ...(b.photo ? { photo: b.photo } : {}),
      })

      if (method === 'POST' && !id) {
        const err = check(body, null, true)
        if (err) return fail(err, 422)
        const nt = { id: crypto.randomUUID(), academyId: t.academyId, photo: null, ...clean(body), passwordHash: hashPassword(body.password) }
        db.teachers.push(nt)
        await save(db)
        return json(pub(nt), 201)
      }

      const i = id ? db.teachers.findIndex((x) => x.id === id && x.academyId === t.academyId) : -1
      if (i < 0) return fail('Profesor no encontrado', 404)

      if (method === 'PUT') {
        const err = check(body, id, false)
        if (err) return fail(err, 422)
        if (id === t.id && !body.isAdmin) return fail('No puedes quitarte el rol de administrador a ti')
        db.teachers[i] = {
          ...db.teachers[i],
          ...clean(body),
          ...(body.password ? { passwordHash: hashPassword(body.password) } : {}),
        }
        await save(db)
        return json(pub(db.teachers[i]))
      }

      if (method === 'DELETE') {
        if (id === t.id) return fail('No puedes eliminar tu propio usuario')
        db.teachers.splice(i, 1)
        await save(db)
        return json({ message: 'Profesor eliminado' })
      }
    }
  }

  return fail('Ruta no encontrada', 404)
}

export const config = { path: '/api/*' }
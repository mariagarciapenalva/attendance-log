import { getStore } from '@netlify/blobs'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { seed } from '../lib/seed.mjs'
import { hashPassword, checkPassword } from '../lib/passwords.mjs'
import { BELT_SYSTEMS, beltInfo, nextRank, rankProgress } from '../../shared/belts.js'

const REQUEST_WINDOW_DAYS = 14 // students can ask about classes up to 2 weeks back
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
  if (db) return db
  await store().setJSON('db', seed)
  return structuredClone(seed)
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

// ---------- accounts ----------
const USERNAME = /^[a-z0-9._-]{3,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (s) => String(s ?? '').trim().toLowerCase()
const validPhoto = (p) => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 400_000

function validateAccount(db, b, { selfId = null, requirePassword = false } = {}) {
  if (!String(b.name ?? '').trim()) return 'Falta el nombre'
  const username = norm(b.username)
  const email = norm(b.email)
  if (!USERNAME.test(username)) return 'Usuario: de 3 a 20 caracteres (minúsculas, números, punto, guion)'
  if (!EMAIL.test(email)) return 'Email no válido'
  const clash = [...db.students, ...db.teachers].find((u) => u.id !== selfId && (u.username === username || u.email === email))
  if (clash) return clash.username === username ? 'Ese nombre de usuario ya existe' : 'Ese email ya está registrado'
  if ((requirePassword || b.password) && String(b.password ?? '').length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  return null
}

// ---------- domain ----------
const scopeOf = (db, t) => (t.isAdmin ? db.groups.map((g) => g.id) : t.groupIds)
// the always-open demo group never makes a student visible to a teacher on its own
const inScope = (gids, s) => s.groupIds.some((g) => g !== 'demo' && gids.includes(g))
const className = (db, id) => db.classes.find((c) => c.id === id)?.name
const publicGroupIds = (db) => db.groups.filter((g) => g.id !== 'demo').map((g) => g.id)

function validBelt(belt) {
  const sys = BELT_SYSTEMS[belt?.system]
  if (!sys || !Number.isInteger(belt.index) || belt.index < 0 || belt.index >= sys.belts.length) return false
  return Number.isInteger(belt.stripes) && belt.stripes >= 0 && belt.stripes <= sys.belts[belt.index].maxStripes
}
const sameBelt = (a, b) => a?.system === b?.system && a?.index === b?.index && a?.stripes === b?.stripes
const defaultBelt = (groupIds) => ({ system: groupIds.includes('kids') ? 'bjj-kids' : 'bjj-adult', index: 0, stripes: 0 })

function beltProgress(db, s) {
  if (!beltInfo(s.belt)) return null
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

const studentView = (db, s) => ({ ...pub(s), progress: beltProgress(db, s), rate: attendanceRate(db, s.id) })

// Classes of the student's groups in the last 14 days, already started,
// where they are NOT marked present and have no pending request
function requestableSessions(db, s, now) {
  const out = []
  for (let back = 0; back <= REQUEST_WINDOW_DAYS; back++) {
    const date = shiftDate(now.date, -back)
    const wd = isoWeekday(date)
    for (const c of db.classes) {
      if (c.fallback || c.weekday !== wd || !s.groupIds.includes(c.groupId)) continue
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
  const [resource, id, action] = new URL(req.url).pathname.replace(/^\/api\/?/, '').split('/')
  const method = req.method
  const body = ['POST', 'PUT'].includes(method) ? await req.json().catch(() => ({})) : {}
  const auth = readToken(req)
  const db = await load()
  const now = madridNow()

  // ===== public =====
  if (method === 'GET' && resource === 'groups') {
    return json(db.groups.filter((g) => g.id !== 'demo').map(({ id, name }) => ({ id, name })))
  }

  if (method === 'POST' && resource === 'register') {
    const err = validateAccount(db, body, { requirePassword: true })
    if (err) return fail(err, 422)
    if (body.password !== body.passwordConfirmation) return fail('Las contraseñas no coinciden', 422)
    if (!validPhoto(body.photo)) return fail('Sube una foto tuya (JPG o PNG)', 422)
    const groupIds = (Array.isArray(body.groupIds) ? body.groupIds : []).filter((g) => publicGroupIds(db).includes(g))
    if (!groupIds.length) return fail('Elige al menos una clase', 422)
    if (body.consent !== true) return fail('Falta aceptar el tratamiento de datos', 422)

    db.students.push({
      id: crypto.randomUUID(),
      name: String(body.name).trim(),
      username: norm(body.username),
      email: norm(body.email),
      passwordHash: hashPassword(body.password),
      photo: body.photo,
      groupIds: [...groupIds, 'demo'], // 'demo' only for the demo open mat; remove for real use
      belt: defaultBelt(groupIds),
      promotedAt: now.date,
      beltSince: now.date,
      createdAt: now.date,
    })
    await save(db)
    return json({ message: 'Cuenta creada. Ya puedes iniciar sesión.' }, 201)
  }

  if (method === 'POST' && resource === 'login') {
    const who = norm(body.identifier)
    const teacher = db.teachers.find((u) => u.username === who || u.email === who)
    const user = teacher ?? db.students.find((u) => u.username === who || u.email === who)
    if (!user || !checkPassword(body.password, user.passwordHash)) return fail('Usuario o contraseña incorrectos', 401)
    const role = teacher ? 'teacher' : 'student'
    return json({
      token: sign({ role, id: user.id }),
      user: { id: user.id, name: user.name, role, isAdmin: !!user.isAdmin },
    })
  }

  // ===== own profile (students and teachers) =====
  if (resource === 'profile') {
    const list = auth?.role === 'teacher' ? db.teachers : auth?.role === 'student' ? db.students : null
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

  // ===== student =====
  if (resource === 'me' || (resource === 'requests' && auth?.role !== 'teacher')) {
    const s = auth?.role === 'student' && db.students.find((x) => x.id === auth.id)
    if (!s) return fail('Sesión caducada, vuelve a entrar', 401)

    if (method === 'GET' && resource === 'me') {
      return json({
        student: studentView(db, s),
        history: db.attendance
          .filter((a) => a.studentId === s.id && a.present)
          .map((a) => ({ date: a.date, className: className(db, a.classId) }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 15),
        sessions: requestableSessions(db, s, now),
        requests: db.requests
          .filter((r) => r.studentId === s.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10)
          .map((r) => ({ ...r, className: className(db, r.classId) })),
        promotions: db.promotions.filter((p) => p.studentId === s.id),
      })
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

  // ===== teacher =====
  if (['teacher', 'attendance', 'students', 'teachers', 'requests', 'reset'].includes(resource)) {
    const t = auth?.role === 'teacher' && db.teachers.find((x) => x.id === auth.id)
    if (!t) return fail('Solo para profesores', 401)
    const gids = scopeOf(db, t)
    const admin = !!t.isAdmin

    if (method === 'GET' && resource === 'teacher' && id === 'state') {
      const classes = db.classes.filter((c) => gids.includes(c.groupId))
      const classIds = new Set(classes.map((c) => c.id))
      return json({
        now,
        me: pub(t),
        groups: db.groups.filter((g) => gids.includes(g.id)),
        classes,
        students: db.students.filter((s) => inScope(gids, s)).map((s) => studentView(db, s)),
        attendance: db.attendance.filter((a) => a.date === now.date && classIds.has(a.classId)),
        requests: db.requests.filter((r) => r.status === 'pending' && classIds.has(r.classId)),
        ...(admin ? { teachers: db.teachers.map(pub), allGroups: db.groups } : {}),
      })
    }

    // Teacher records attendance for one class: today, or up to 3 days back (saves made offline arrive late)
    if (method === 'PUT' && resource === 'attendance' && id) {
      const cls = db.classes.find((c) => c.id === id)
      if (!cls || !gids.includes(cls.groupId)) return fail('Esa clase no es de tus grupos', 403)
      const date = body.date ?? now.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > now.date || date < shiftDate(now.date, -3)) {
        return fail('Fecha de asistencia no válida (como mucho 3 días atrás)', 422)
      }
      if (isoWeekday(date) !== cls.weekday) return fail('Esa clase no se imparte ese día', 422)
      const marks = body.marks ?? {}
      db.attendance = db.attendance.filter((a) => !(a.classId === id && a.date === date))
      for (const [studentId, present] of Object.entries(marks)) {
        db.attendance.push({ classId: id, date, studentId, present: !!present, by: t.id })
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
      const cls = r && db.classes.find((c) => c.id === r.classId)
      if (!r || !cls || !gids.includes(cls.groupId)) return fail('Solicitud no encontrada', 404)
      if (r.status !== 'pending') return fail('Esta solicitud ya está resuelta')
      if (action === 'approve') {
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
      if (i < 0 || !inScope(gids, db.students[i])) return fail('Alumno no encontrado', 404)
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

    if (resource === 'teachers') {
      if (!admin) return fail('Solo el administrador gestiona el equipo', 403)
      const check = (b, selfId, isNew) =>
        validateAccount(db, b, { selfId, requirePassword: isNew })
        || (!Array.isArray(b.groupIds) || b.groupIds.some((g) => !db.groups.some((x) => x.id === g)) ? 'Grupos no válidos' : null)
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
        const nt = { id: crypto.randomUUID(), photo: null, ...clean(body), passwordHash: hashPassword(body.password) }
        db.teachers.push(nt)
        await save(db)
        return json(pub(nt), 201)
      }

      const i = id ? db.teachers.findIndex((x) => x.id === id) : -1
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

    if (method === 'POST' && resource === 'reset') {
      if (!admin) return fail('Solo el administrador', 403)
      await store().delete('db')
      return json({ message: 'Datos reiniciados' })
    }
  }

  return fail('Ruta no encontrada', 404)
}

export const config = { path: '/api/*' }
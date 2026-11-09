import { ref } from "vue";
import { API_BASE_URL, headers } from "../config/apiConfig";
import useAuth from "./useAuth";

const teacherState = ref(null) // scoped to the logged-in teacher's groups
const loadError = ref('')

// ---------- offline support ----------
// Attendance saved without internet waits here (in this phone's storage) and is sent when the connection returns.
const OUTBOX_KEY = 'attendance-outbox'
const readOutbox = () => {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) ?? [] } catch { return [] }
}
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const pendingCount = ref(readOutbox().length)
const syncError = ref('')
const writeOutbox = (items) => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items))
    pendingCount.value = items.length
}

class NetworkError extends Error {}
class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status }
}

// Today's date in the dojo's time zone (YYYY-MM-DD), computed on the phone so it works offline
export const todayInDojo = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

const request = async (path, { method = "GET", body } = {}) => {
    const { token, logout } = useAuth()
    let response
    try {
        response = await fetch(`${API_BASE_URL}/${path}`, {
            method,
            headers: headers(token.value),
            body: body ? JSON.stringify(body) : undefined
        })
    } catch {
        online.value = false
        throw new NetworkError('Sin conexión a internet')
    }
    // a reply may come from the offline cache, so trust the browser's own connection flag here
    online.value = navigator.onLine
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && token.value) logout() // expired session
    if (!response.ok) throw new ApiError(data.message || `Error ${response.status}`, response.status)
    return data
}

// Sends queued attendance, oldest first. Stops at the first network failure and keeps the rest.
let syncing = false
async function syncOutbox() {
    if (syncing || !readOutbox().length) return
    syncing = true
    try {
        for (const item of readOutbox()) {
            try {
                await request(`attendance/${encodeURIComponent(item.classId)}`, { method: "PUT", body: { marks: item.marks, date: item.date } })
            } catch (e) {
                if (e instanceof NetworkError || e.status === 401) break // try again later (or after logging in)
                syncError.value = `No se pudo enviar la asistencia del ${item.date}: ${e.message}`
            }
            writeOutbox(readOutbox().filter((i) => !(i.classId === item.classId && i.date === item.date)))
        }
    } finally {
        syncing = false
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { online.value = true; syncOutbox() })
    window.addEventListener('offline', () => { online.value = false })
}

export function useDojo() {
    const fetchTeacherState = async () => {
        try {
            teacherState.value = await request('teacher/state')
            loadError.value = ''
            syncOutbox()
        } catch (error) {
            if (!teacherState.value) loadError.value = error.message
        }
    }

    // Saves the attendance of one class on a day (today by default); without internet it is queued and sent later
    const saveAttendance = async (classId, marks, date = todayInDojo()) => {
        try {
            await request(`attendance/${encodeURIComponent(classId)}`, { method: "PUT", body: { marks, date } })
            return { queued: false }
        } catch (e) {
            if (!(e instanceof NetworkError)) throw e
            const others = readOutbox().filter((i) => !(i.classId === classId && i.date === date))
            writeOutbox([...others, { classId, date, marks, savedAt: new Date().toISOString() }])
            return { queued: true }
        }
    }

    return {
        teacherState, loadError, fetchTeacherState,
        online, pendingCount, syncError, syncOutbox,
        // public
        fetchAcademies: () => request('academies'),
        fetchGroups: (academyId) => request(`groups?academy=${encodeURIComponent(academyId)}`),
        // any logged-in user
        fetchProfile: () => request('profile'),
        updateProfile: (fields) => request('profile', { method: "PUT", body: fields }),
        // student
        fetchMe: () => request('me'),
        requestAttendance: (classId, date, note) => request('requests', { method: "POST", body: { classId, date, note } }),
        // "I trained out": { date, academyId } for a dojo of the app, or { date, place } for anywhere else
        requestTrainingOut: (fields) => request('requests', { method: "POST", body: { ...fields, out: true } }),
        // teacher
        saveAttendance,
        fetchAttendance: (date) => request(`attendance?date=${date}`),
        approveRequest: (id) => request(`requests/${id}/approve`, { method: "POST" }),
        rejectRequest: (id, reply) => request(`requests/${id}/reject`, { method: "POST", body: { reply } }),
        updateStudent: (id, s) => request(`students/${id}`, { method: "PUT", body: s }),
        deleteStudent: (id) => request(`students/${id}`, { method: "DELETE" }),
        promoteStudent: (id) => request(`students/${id}/promote`, { method: "POST" }),
        searchGuests: (q) => request(`guests?q=${encodeURIComponent(q)}`),
        // dojos: switch, ask for access, and (admins) answer requests
        switchAcademy: async (academyId) => {
            const data = await request('teacher/switch', { method: "POST", body: { academyId } })
            useAuth().setSession(data)
            teacherState.value = null
            return data
        },
        fetchAccess: () => request('access'),
        requestAccess: (academyId, role, note) => request('access', { method: "POST", body: { academyId, role, note } }),
        approveAccess: (id, groupIds) => request(`access/${id}/approve`, { method: "POST", body: { groupIds } }),
        rejectAccess: (id) => request(`access/${id}/reject`, { method: "POST" }),
        removeAccess: (teacherId) => request(`access/${teacherId}`, { method: "DELETE" }),
        // academy admin
        createGroup: (name) => request('groups', { method: "POST", body: { name } }),
        createClass: (cls) => request('classes', { method: "POST", body: cls }),
        deleteClass: (id) => request(`classes/${encodeURIComponent(id)}`, { method: "DELETE" }),
        // superadmin
        fetchAdminAcademies: () => request('admin/academies'),
        createAcademy: (academy) => request('admin/academies', { method: "POST", body: academy }),
        // academy admin: team
        createTeacher: (t) => request('teachers', { method: "POST", body: t }),
        updateTeacher: (id, t) => request(`teachers/${id}`, { method: "PUT", body: t }),
        deleteTeacher: (id) => request(`teachers/${id}`, { method: "DELETE" }),
    }
}
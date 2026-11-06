import { ref } from "vue";
import { API_BASE_URL, headers } from "../config/apiConfig";
import useAuth from "./useAuth";

const teacherState = ref(null) // scoped to the logged-in teacher's groups
const loadError = ref('')

const request = async (path, { method = "GET", body } = {}) => {
    const { token, logout } = useAuth()
    const response = await fetch(`${API_BASE_URL}/${path}`, {
        method,
        headers: headers(token.value),
        body: body ? JSON.stringify(body) : undefined
    })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401 && token.value) logout() // expired session
    if (!response.ok) throw new Error(data.message || `Error ${response.status}`)
    return data
}

export function useDojo() {
    const fetchTeacherState = async () => {
        try { teacherState.value = await request('teacher/state'); loadError.value = '' }
        catch (error) { loadError.value = error.message }
    }

    return {
        teacherState, loadError, fetchTeacherState,
        // public
        fetchGroups: () => request('groups'),
        // any logged-in user
        fetchProfile: () => request('profile'),
        updateProfile: (fields) => request('profile', { method: "PUT", body: fields }),
        // student
        fetchMe: () => request('me'),
        requestAttendance: (classId, date, note) => request('requests', { method: "POST", body: { classId, date, note } }),
        // teacher
        saveAttendance: (classId, marks) => request(`attendance/${classId}`, { method: "PUT", body: { marks } }),
        approveRequest: (id) => request(`requests/${id}/approve`, { method: "POST" }),
        rejectRequest: (id, reply) => request(`requests/${id}/reject`, { method: "POST", body: { reply } }),
        updateStudent: (id, s) => request(`students/${id}`, { method: "PUT", body: s }),
        deleteStudent: (id) => request(`students/${id}`, { method: "DELETE" }),
        promoteStudent: (id) => request(`students/${id}/promote`, { method: "POST" }),
        // admin
        createTeacher: (t) => request('teachers', { method: "POST", body: t }),
        updateTeacher: (id, t) => request(`teachers/${id}`, { method: "PUT", body: t }),
        deleteTeacher: (id) => request(`teachers/${id}`, { method: "DELETE" }),
    }
}

import { ref } from "vue";
import { API_BASE_URL, headers } from "../config/apiConfig";

const readUser = () => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
}

const token = ref(localStorage.getItem('token'))
const user = ref(readUser()) // { id, name, role: 'student' | 'teacher', isAdmin }

// register (students)
const register = async (fields) => {
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(fields)
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed register')
        return { success: true, message: data.message }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// login (students and teachers): username or email + password
const login = async (identifier, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ identifier, password })
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Login failed')

        token.value = data.token
        user.value = data.user
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // forget the data cached for offline use, so the next person on this phone doesn't see it
    if (typeof caches !== 'undefined') caches.delete('api-data').catch(() => {})
}

const isAuthenticated = (role = null) => !!token.value && (!role || user.value?.role === role)
const isAdmin = () => !!user.value?.isAdmin

export default function useAuth() {
    return { token, user, register, login, logout, isAuthenticated, isAdmin }
}
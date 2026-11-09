import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import LoginForm from '../views/LoginForm.vue'
import RegisterForm from '../views/RegisterForm.vue'
import ProfilePage from '../views/ProfilePage.vue'
import StudentPage from '../views/StudentPage.vue'
import RosterPage from '../views/RosterPage.vue'
import RequestsPage from '../views/RequestsPage.vue'
import StudentsPage from '../views/StudentsPage.vue'
import TeachersPage from '../views/TeachersPage.vue'
import SchedulePage from '../views/SchedulePage.vue'
import SuperadminPage from '../views/SuperadminPage.vue'
import AccessPage from '../views/AccessPage.vue'
import useAuth from '../composables/useAuth'

const routes = [
    { path: '/', name: 'home', component: Home },
    { path: '/login', name: 'login', component: LoginForm },
    { path: '/register', name: 'register', component: RegisterForm },
    { path: '/perfil', name: 'profile', component: ProfilePage, meta: { auth: true } },
    { path: '/alumno', name: 'student', component: StudentPage, meta: { role: 'student' } },
    { path: '/profesor', name: 'roster', component: RosterPage, meta: { role: 'teacher' } },
    { path: '/profesor/solicitudes', name: 'requests', component: RequestsPage, meta: { role: 'teacher' } },
    { path: '/profesor/alumnos', name: 'students', component: StudentsPage, meta: { role: 'teacher' } },
    { path: '/profesor/equipo', name: 'team', component: TeachersPage, meta: { role: 'teacher', admin: true } },
    { path: '/profesor/horario', name: 'schedule', component: SchedulePage, meta: { role: 'teacher', admin: true } },
    { path: '/profesor/dojos', name: 'access', component: AccessPage, meta: { role: 'teacher' } },
    { path: '/superadmin', name: 'superadmin', component: SuperadminPage, meta: { role: 'superadmin' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
]

// hash history: no _redirects needed, so /api/* always reaches the function
const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to, from, next) => {
    const { isAuthenticated, isAdmin, homePath } = useAuth()
    if ((to.meta.auth && !isAuthenticated()) || (to.meta.role && !isAuthenticated(to.meta.role))) {
        next('/login')
    } else if (to.meta.admin && !isAdmin()) {
        next('/profesor')
    } else if (['home', 'login'].includes(to.name) && isAuthenticated()) {
        next(homePath())
    } else {
        next()
    }
})

export default router
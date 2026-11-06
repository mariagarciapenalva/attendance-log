<script setup>
    import { computed } from 'vue'
    import { useRouter } from 'vue-router'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'

    const router = useRouter()
    const { user, logout, isAdmin } = useAuth()
    const { teacherState } = useDojo()
    const pending = computed(() => teacherState.value?.requests?.length ?? 0)

    const handleLogout = () => { logout(); router.push('/') }
    const link = 'px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5'
    const active = 'bg-white !text-indigo-800 hover:!bg-white'
</script>

<template>
    <header class="bg-indigo-800 text-white shadow-lg">
        <div class="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="font-bold text-lg leading-tight">Dojo · Profesor</h1>
                <p class="text-xs opacity-80">{{ user?.name }}</p>
            </div>
            <nav class="flex flex-wrap gap-1 text-sm font-medium">
                <router-link to="/profesor" :class="link" :exact-active-class="active">Asistencia</router-link>
                <router-link to="/profesor/solicitudes" :class="link" :exact-active-class="active">
                    Solicitudes
                    <span v-if="pending" class="bg-amber-400 text-black text-xs font-bold rounded-full px-1.5">{{ pending }}</span>
                </router-link>
                <router-link to="/profesor/alumnos" :class="link" :exact-active-class="active">Alumnos</router-link>
                <router-link v-if="isAdmin()" to="/profesor/equipo" :class="link" :exact-active-class="active">Equipo</router-link>
                <router-link to="/perfil" :class="link" :exact-active-class="active">Perfil</router-link>
                <button @click="handleLogout" :class="link">Salir</button>
            </nav>
        </div>
    </header>
</template>

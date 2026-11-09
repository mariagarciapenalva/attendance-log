<script setup>
    import { ref, reactive, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import { PlusIcon } from '@heroicons/vue/24/solid'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'
    import Spinner from '../components/Spinner.vue'
    import PasswordToggle from '../components/PasswordToggle.vue'

    // Superadmin: creates academies, each with its class groups and its first sensei (admin)
    const router = useRouter()
    const { user, logout } = useAuth()
    const { fetchAdminAcademies, createAcademy } = useDojo()

    const SUGGESTED_GROUPS = ['Jiujitsu', 'Jiujitsu Kids', 'Jiujitsu Introducción', 'Grappling', 'Open mat']

    const academies = ref(null)
    const error = ref('')
    const showForm = ref(false)
    const loading = ref(false)
    const passwordVisible = ref(false)
    const form = reactive({
        name: '',
        groups: ['Jiujitsu', 'Jiujitsu Kids'],
        extraGroup: '',
        admin: { name: '', username: '', email: '', password: '' },
    })
    const formMsg = ref(null)

    const load = async () => {
        try { academies.value = await fetchAdminAcademies() }
        catch (e) { error.value = e.message }
    }

    const addExtraGroup = () => {
        const g = form.extraGroup.trim()
        if (g && !form.groups.includes(g)) form.groups.push(g)
        form.extraGroup = ''
    }

    const handleCreate = async () => {
        loading.value = true
        formMsg.value = null
        try {
            const a = await createAcademy({ name: form.name, groups: form.groups, admin: { ...form.admin } })
            formMsg.value = { ok: true, text: `${a.name} creada. Su sensei ya puede entrar como «${form.admin.username}».` }
            Object.assign(form, { name: '', groups: ['Jiujitsu', 'Jiujitsu Kids'], extraGroup: '' })
            Object.assign(form.admin, { name: '', username: '', email: '', password: '' })
            showForm.value = false
            await load()
        } catch (e) {
            formMsg.value = { ok: false, text: e.message }
        } finally {
            loading.value = false
        }
    }

    const signupLink = (id) => `${location.origin}/#/register?academia=${id}`
    const copied = ref('')
    const copyLink = async (id) => {
        try { await navigator.clipboard.writeText(signupLink(id)); copied.value = id; setTimeout(() => (copied.value = ''), 2000) }
        catch { copied.value = '' }
    }

    const handleLogout = () => { logout(); router.push('/') }
    onMounted(load)

    const input = 'border-2 w-full p-2 mt-1 rounded-md focus:outline-none focus:border-blue-500 font-normal'
</script>

<template>
    <header class="bg-gray-900 text-white shadow-lg">
        <div class="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="font-bold text-lg leading-tight">Dojo · Superadmin</h1>
                <p class="text-xs opacity-80">{{ user?.name }}</p>
            </div>
            <nav class="flex gap-1 text-sm font-medium">
                <router-link to="/perfil" class="px-3 py-1.5 rounded-lg hover:bg-gray-700">Perfil</router-link>
                <button @click="handleLogout" class="px-3 py-1.5 rounded-lg hover:bg-gray-700">Salir</button>
            </nav>
        </div>
    </header>

    <div class="max-w-5xl mx-auto p-4 flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-black text-2xl">Academias</h2>
            <button v-if="!showForm" @click="showForm = true"
                    class="flex items-center gap-1 bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg">
                <PlusIcon class="h-5 w-5" /> Nueva academia
            </button>
        </div>

        <p v-if="formMsg" :class="['text-sm font-medium', formMsg.ok ? 'text-green-700' : 'text-red-600']">{{ formMsg.text }}</p>

        <!-- new academy -->
        <form v-if="showForm" @submit.prevent="handleCreate" class="bg-white rounded-xl drop-shadow-md p-5 flex flex-col gap-4 max-w-xl">
            <label class="block text-gray-700 text-sm font-bold">
                Nombre de la academia
                <input id="a-name" v-model="form.name" required placeholder="p. ej. Dojo4" :class="input" />
            </label>

            <fieldset class="border-2 rounded-md p-3">
                <legend class="text-sm font-bold text-gray-700 px-1">Grupos de clases</legend>
                <label v-for="g in [...new Set([...SUGGESTED_GROUPS, ...form.groups])]" :key="g" class="flex items-center gap-2 py-1">
                    <input type="checkbox" :value="g" v-model="form.groups" /> {{ g }}
                </label>
                <div class="flex gap-2 mt-2">
                    <input id="a-extra" v-model="form.extraGroup" placeholder="Otro grupo" class="border-2 p-2 rounded-md flex-1 min-w-0"
                           @keydown.enter.prevent="addExtraGroup" />
                    <button type="button" @click="addExtraGroup" class="border-2 border-indigo-800 text-indigo-800 font-bold px-3 rounded-lg">Añadir</button>
                </div>
                <p class="text-xs text-gray-500 mt-2">El horario lo monta después su sensei desde «Horario».</p>
            </fieldset>

            <fieldset class="border-2 rounded-md p-3 grid gap-3">
                <legend class="text-sm font-bold text-gray-700 px-1">Sensei (administrador de la academia)</legend>
                <label class="block text-gray-700 text-sm font-bold">Nombre
                    <input id="a-admin-name" v-model="form.admin.name" required :class="input" />
                </label>
                <label class="block text-gray-700 text-sm font-bold">Usuario
                    <input id="a-admin-user" v-model="form.admin.username" required autocomplete="off" autocapitalize="none" :class="input" />
                </label>
                <label class="block text-gray-700 text-sm font-bold">Email
                    <input id="a-admin-email" type="email" v-model="form.admin.email" required autocomplete="off" :class="input" />
                </label>
                <label class="block text-gray-700 text-sm font-bold">Contraseña inicial
                    <div class="relative">
                        <input id="a-admin-pass" :type="passwordVisible ? 'text' : 'password'" v-model="form.admin.password"
                               required minlength="8" autocomplete="new-password" :class="[input, 'pr-10']" />
                        <PasswordToggle :passwordVisible="passwordVisible" @toggle="passwordVisible = !passwordVisible" />
                    </div>
                    <span class="font-normal text-xs text-gray-500">Pásasela al sensei; puede cambiarla en su perfil.</span>
                </label>
            </fieldset>

            <div class="flex gap-2 justify-end">
                <button type="button" @click="showForm = false" class="bg-gray-300 hover:bg-gray-400 py-2 px-4 rounded-lg">Cancelar</button>
                <button type="submit" :disabled="loading"
                        class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Crear academia</button>
            </div>
        </form>

        <!-- list -->
        <p v-if="error" class="text-red-600">{{ error }}</p>
        <div v-else-if="!academies" class="flex justify-center py-20"><Spinner /></div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <article v-for="a in academies" :key="a.id" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-2">
                <h3 class="font-bold text-lg">{{ a.name }}</h3>
                <p class="text-sm text-gray-600 tabular-nums">{{ a.students }} alumnos · {{ a.teachers }} profesores · {{ a.classes }} clases/semana</p>
                <p class="text-sm text-gray-600">Sensei: <span v-for="(ad, i) in a.admins" :key="ad.username">{{ i ? ', ' : '' }}{{ ad.name }} (@{{ ad.username }})</span></p>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                    <span class="text-gray-500 truncate min-w-0">Enlace de registro:</span>
                    <code class="text-xs bg-gray-100 rounded px-1.5 py-0.5 select-all break-all">{{ signupLink(a.id) }}</code>
                    <button @click="copyLink(a.id)" class="text-indigo-800 font-semibold">{{ copied === a.id ? 'Copiado' : 'Copiar' }}</button>
                </div>
            </article>
        </div>
    </div>
</template>
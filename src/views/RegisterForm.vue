<script setup>
    import { reactive, ref, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'
    import PasswordToggle from '../components/PasswordToggle.vue'
    import PhotoInput from '../components/PhotoInput.vue'
    import Spinner from '../components/Spinner.vue'

    const { register } = useAuth()
    const { fetchGroups } = useDojo()
    const router = useRouter()

    const fields = reactive({
        name: '', username: '', email: '', password: '', passwordConfirmation: '',
        photo: null, groupIds: [], consent: false,
    })
    const groups = ref([])
    const error = ref('')
    const loading = ref(false)
    const passwordVisible = ref(false)

    const handleRegister = async () => {
        if (!fields.photo) { error.value = 'Sube una foto tuya para que tu profe te reconozca'; return }
        if (!fields.groupIds.length) { error.value = 'Elige al menos una clase'; return }
        if (fields.password !== fields.passwordConfirmation) { error.value = 'Las contraseñas no coinciden'; return }
        if (!fields.consent) { error.value = 'Falta aceptar el tratamiento de datos'; return }
        error.value = ''
        loading.value = true
        const result = await register({ ...fields, username: fields.username.trim().toLowerCase() })
        loading.value = false
        if (result.success) router.push({ path: '/login', query: { registered: '1' } })
        else error.value = result.error
    }

    onMounted(async () => {
        try { groups.value = await fetchGroups() } catch (e) { error.value = e.message }
    })

    const input = 'border-2 w-full p-2 mt-2 placeholder-gray-400 rounded-md focus:outline-none focus:border-blue-500 font-normal'
</script>

<template>
    <div class="min-h-screen w-full flex justify-center p-4 relative">
        <div v-if="loading" class="fixed inset-0 bg-white/70 flex items-center justify-center z-50">
            <Spinner />
        </div>
        <div class="w-full max-w-md">
            <router-link to="/" class="text-indigo-800 font-medium">← Volver</router-link>
            <h1 class="font-black text-3xl text-center mt-2">Crear cuenta de alumno</h1>

            <form class="bg-white shadow-lg rounded-lg py-8 px-5 mb-10 mt-5 flex flex-col gap-5" @submit.prevent="handleRegister">
                <PhotoInput v-model="fields.photo" :name="fields.name" />

                <label class="block text-gray-700 text-sm font-bold">
                    Nombre y apellidos
                    <input id="r-name" v-model="fields.name" required autocomplete="name" :class="input" />
                </label>
                <label class="block text-gray-700 text-sm font-bold">
                    Nombre de usuario
                    <input id="r-username" v-model="fields.username" required autocomplete="username" autocapitalize="none"
                           pattern="[a-zA-Z0-9._\-]{3,20}" placeholder="p. ej. laia.puig" :class="input" />
                    <span class="font-normal text-xs text-gray-500">3–20 caracteres: letras, números, punto o guion</span>
                </label>
                <label class="block text-gray-700 text-sm font-bold">
                    Email
                    <input id="r-email" type="email" v-model="fields.email" required autocomplete="email" :class="input" />
                </label>
                <label class="block text-gray-700 text-sm font-bold">
                    Contraseña
                    <div class="relative">
                        <input id="r-password" :type="passwordVisible ? 'text' : 'password'" v-model="fields.password"
                               required minlength="8" autocomplete="new-password" :class="[input, 'pr-10']" />
                        <PasswordToggle :passwordVisible="passwordVisible" @toggle="passwordVisible = !passwordVisible" />
                    </div>
                    <span class="font-normal text-xs text-gray-500">Mínimo 8 caracteres</span>
                </label>
                <label class="block text-gray-700 text-sm font-bold">
                    Repite la contraseña
                    <input id="r-password2" :type="passwordVisible ? 'text' : 'password'" v-model="fields.passwordConfirmation"
                           required minlength="8" autocomplete="new-password" :class="input" />
                </label>

                <fieldset class="border-2 rounded-md p-3">
                    <legend class="text-sm font-bold text-gray-700 px-1">¿A qué clases vienes?</legend>
                    <label v-for="g in groups" :key="g.id" class="flex items-center gap-2 py-1">
                        <input type="checkbox" :value="g.id" v-model="fields.groupIds" /> {{ g.name }}
                    </label>
                </fieldset>

                <label class="flex items-start gap-2 text-sm text-gray-700">
                    <input id="r-consent" type="checkbox" v-model="fields.consent" class="mt-1" />
                    <span>
                        Acepto que el dojo guarde mis datos y mi foto para gestionar la asistencia y los grados.
                        Si el alumno es menor de 14 años, este registro lo hace su madre, padre o tutor legal.
                    </span>
                </label>

                <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

                <button type="submit"
                        class="bg-indigo-800 w-full py-3 px-4 text-white font-medium rounded-md hover:bg-indigo-900 transition-colors">
                    Crear cuenta
                </button>
                <p class="text-center text-sm text-gray-500">
                    ¿Ya tienes cuenta?
                    <router-link to="/login" class="text-indigo-800 hover:text-indigo-900 font-medium">Inicia sesión</router-link>
                </p>
            </form>
        </div>
    </div>
</template>

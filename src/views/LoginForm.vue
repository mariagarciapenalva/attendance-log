<script setup>
    import { reactive, ref } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import useAuth from '../composables/useAuth'
    import PasswordToggle from '../components/PasswordToggle.vue'
    import Spinner from '../components/Spinner.vue'

    const { login, user } = useAuth()
    const router = useRouter()
    const route = useRoute()

    const fields = reactive({ identifier: '', password: '' })
    const error = ref('')
    const loading = ref(false)
    const passwordVisible = ref(false)

    const handleLogin = async () => {
        if (Object.values(fields).includes('')) {
            error.value = 'Rellena todos los campos'
            return
        }
        error.value = ''
        loading.value = true
        const result = await login(fields.identifier, fields.password)
        loading.value = false
        if (result.success) {
            router.push(user.value.role === 'teacher' ? '/profesor' : '/alumno')
        } else {
            error.value = result.error
        }
    }
</script>

<template>
    <div class="min-h-screen w-full flex items-center justify-center p-4 relative">
        <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
            <Spinner />
        </div>
        <div class="w-full max-w-md">
            <router-link to="/" class="text-indigo-800 font-medium">← Volver</router-link>
            <h1 class="font-black text-3xl text-center mt-2">Iniciar sesión</h1>
            <p v-if="route.query.registered" class="mt-4 bg-green-100 text-green-800 rounded-lg p-3 text-sm font-medium">
                Cuenta creada. Ya puedes iniciar sesión.
            </p>
            <form class="bg-white shadow-lg rounded-lg py-10 px-5 mb-10 mt-5" @submit.prevent="handleLogin">
                <div class="mb-5">
                    <label for="identifier" class="block text-gray-700 text-sm font-bold mb-2">Usuario o email</label>
                    <input id="identifier" v-model="fields.identifier" autocomplete="username" autocapitalize="none"
                           class="border-2 w-full p-2 mt-2 placeholder-gray-400 rounded-md focus:outline-none focus:border-blue-500"
                           placeholder="laia o laia@demo.dojo" />
                </div>
                <div class="mb-5">
                    <label for="password" class="block text-gray-700 text-sm font-bold mb-2">Contraseña</label>
                    <div class="relative mt-2">
                        <input id="password" :type="passwordVisible ? 'text' : 'password'" v-model="fields.password"
                               autocomplete="current-password"
                               :class="['border-2 w-full p-2 pr-10 placeholder-gray-400 rounded-md focus:outline-none focus:border-blue-500',
                                        error ? 'border-red-500' : 'border-gray-300']" />
                        <PasswordToggle :passwordVisible="passwordVisible" @toggle="passwordVisible = !passwordVisible" />
                    </div>
                </div>
                <p v-if="error" class="text-red-600 text-sm mb-4">{{ error }}</p>
                <button type="submit"
                        class="bg-indigo-800 w-full py-3 px-4 text-white font-medium rounded-md hover:bg-indigo-900 transition-colors">
                    Entrar
                </button>
                <p class="text-center text-sm text-gray-500 mt-5">
                    ¿Aún no tienes cuenta?
                    <router-link to="/register" class="text-indigo-800 hover:text-indigo-900 font-medium">Regístrate</router-link>
                </p>
            </form>
        </div>
    </div>
</template>

<script setup>
    import { reactive, ref, computed, onMounted } from 'vue'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import PhotoInput from '../components/PhotoInput.vue'
    import Spinner from '../components/Spinner.vue'

    const { user } = useAuth()
    const { fetchProfile, updateProfile } = useDojo()
    const isTeacher = computed(() => user.value?.role === 'teacher')

    const profile = ref(null)
    const fields = reactive({ name: '', photo: null, currentPassword: '', newPassword: '' })
    const message = ref(null)
    const loading = ref(false)

    const handleSave = async () => {
        loading.value = true
        message.value = null
        try {
            const body = { name: fields.name, photo: fields.photo ?? undefined }
            if (fields.newPassword) Object.assign(body, { currentPassword: fields.currentPassword, newPassword: fields.newPassword })
            profile.value = await updateProfile(body)
            user.value = { ...user.value, name: profile.value.name }
            localStorage.setItem('user', JSON.stringify(user.value))
            fields.currentPassword = ''
            fields.newPassword = ''
            message.value = { ok: true, text: 'Perfil guardado' }
        } catch (e) {
            message.value = { ok: false, text: e.message }
        } finally {
            loading.value = false
        }
    }

    onMounted(async () => {
        try {
            profile.value = await fetchProfile()
            fields.name = profile.value.name
            fields.photo = profile.value.photo
        } catch (e) {
            message.value = { ok: false, text: e.message }
        }
    })

    const input = 'border-2 w-full p-2 mt-2 rounded-md focus:outline-none focus:border-blue-500 font-normal'
</script>

<template>
    <TeacherNav v-if="isTeacher" />
    <div class="max-w-md mx-auto p-4 flex flex-col gap-4">
        <router-link v-if="!isTeacher" :to="user?.role === 'superadmin' ? '/superadmin' : '/alumno'"
                     class="text-indigo-800 font-medium">← Volver</router-link>
        <h1 class="font-black text-2xl">Mi perfil</h1>

        <div v-if="!profile && !message" class="flex justify-center py-20"><Spinner /></div>

        <form v-if="profile" @submit.prevent="handleSave" class="bg-white rounded-xl drop-shadow-md p-5 flex flex-col gap-4">
            <PhotoInput v-model="fields.photo" :name="fields.name" />
            <p class="text-sm text-gray-500">@{{ profile.username }} · {{ profile.email }}</p>

            <label class="block text-gray-700 text-sm font-bold">
                Nombre
                <input id="p-name" v-model="fields.name" required :class="input" />
            </label>

            <details class="text-sm">
                <summary class="cursor-pointer text-indigo-800 font-medium">Cambiar contraseña</summary>
                <div class="grid gap-3 mt-3">
                    <label class="block text-gray-700 text-sm font-bold">
                        Contraseña actual
                        <input id="p-current" type="password" v-model="fields.currentPassword" autocomplete="current-password" :class="input" />
                    </label>
                    <label class="block text-gray-700 text-sm font-bold">
                        Nueva contraseña
                        <input id="p-new" type="password" v-model="fields.newPassword" minlength="8" autocomplete="new-password" :class="input" />
                    </label>
                </div>
            </details>

            <p v-if="message" :class="['text-sm font-medium', message.ok ? 'text-green-700' : 'text-red-600']">{{ message.text }}</p>

            <button type="submit" :disabled="loading"
                    class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">
                Guardar
            </button>
        </form>
        <p v-else-if="message" class="text-red-600">{{ message.text }}</p>
    </div>
</template>
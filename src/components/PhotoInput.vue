<script setup>
    import { ref } from 'vue'
    import Avatar from './Avatar.vue'
    import { resizeImage } from '../utils/image'

    const photo = defineModel({ default: null })
    defineProps({ name: { type: String, default: '' } })

    const error = ref('')

    // Demo mode: sample photos from public/demo/, so recordings never open your own files.
    // Turn it on with VITE_DEMO_MODE=true (in .env.local or in Netlify's environment variables).
    const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'
    const DEMO_PHOTOS = ['/demo/foto-1.jpg', '/demo/foto-2.jpg', '/demo/foto-3.jpg']

    const setFromFile = async (file) => {
        if (!file.type.startsWith('image/')) { error.value = 'El archivo tiene que ser una imagen'; return }
        try {
            photo.value = await resizeImage(file)
            error.value = ''
        } catch {
            error.value = 'No se ha podido leer la imagen'
        }
    }

    const onFile = (e) => {
        const file = e.target.files?.[0]
        if (file) setFromFile(file)
    }

    const useDemoPhoto = async (url) => {
        try {
            const blob = await (await fetch(url)).blob()
            await setFromFile(new File([blob], 'demo.jpg', { type: blob.type }))
        } catch {
            error.value = 'No se ha podido cargar la foto de ejemplo'
        }
    }
</script>

<template>
    <div class="flex flex-col gap-3">
        <div class="flex items-center gap-4">
            <Avatar :person="{ name, photo }" :size="88" />
            <div class="flex flex-col gap-1">
                <label class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-lg cursor-pointer text-sm text-center">
                    {{ photo ? 'Cambiar foto' : 'Subir foto' }}
                    <input type="file" accept="image/*" class="sr-only" @change="onFile" />
                </label>
                <span class="text-xs text-gray-500">Una foto tuya, de cara. Se recorta en cuadrado.</span>
                <span v-if="error" class="text-xs text-red-600">{{ error }}</span>
            </div>
        </div>

        <div v-if="DEMO" class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Demo:</span>
            <button v-for="url in DEMO_PHOTOS" :key="url" type="button" @click="useDemoPhoto(url)"
                    class="rounded-full ring-2 ring-transparent hover:ring-indigo-800 focus-visible:ring-indigo-800">
                <img :src="url" alt="Foto de ejemplo" class="w-10 h-10 rounded-full object-cover" />
            </button>
        </div>
    </div>
</template>
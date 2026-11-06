<script setup>
    import { ref } from 'vue'
    import Avatar from './Avatar.vue'
    import { resizeImage } from '../utils/image'

    const photo = defineModel({ default: null })
    defineProps({ name: { type: String, default: '' } })

    const error = ref('')

    const onFile = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { error.value = 'El archivo tiene que ser una imagen'; return }
        try {
            photo.value = await resizeImage(file)
            error.value = ''
        } catch {
            error.value = 'No se ha podido leer la imagen'
        }
    }
</script>

<template>
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
</template>

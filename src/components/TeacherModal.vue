<script setup>
    import { reactive, ref } from 'vue'
    import { TrashIcon } from '@heroicons/vue/24/solid'
    import PhotoInput from './PhotoInput.vue'
    import PasswordToggle from './PasswordToggle.vue'

    const props = defineProps({
        initial: { type: Object, required: true },
        groups: { type: Array, required: true },
        save: { type: Function, required: true }, // returns { success, error }
    })
    const emit = defineEmits(['cancel', 'delete'])

    const fields = reactive({ ...props.initial, groupIds: [...props.initial.groupIds] })
    const error = ref('')
    const loading = ref(false)
    const passwordVisible = ref(false)

    const handleSubmit = async () => {
        loading.value = true
        error.value = ''
        const result = await props.save({ ...fields })
        loading.value = false
        if (!result.success) error.value = result.error
    }

    const input = 'border-2 w-full p-2 mt-2 rounded-md focus:outline-none focus:border-blue-500 font-normal'
</script>

<template>
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <form @submit.prevent="handleSubmit"
              class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            <h2 class="text-xl font-semibold">{{ fields.id ? 'Editar profesor' : 'Nuevo profesor' }}</h2>

            <PhotoInput v-model="fields.photo" :name="fields.name" />

            <label class="block text-gray-700 text-sm font-bold">
                Nombre
                <input id="t-name" v-model="fields.name" required :class="input" />
            </label>
            <label class="block text-gray-700 text-sm font-bold">
                Usuario
                <input id="t-username" v-model="fields.username" required autocomplete="off" :class="input" />
            </label>
            <label class="block text-gray-700 text-sm font-bold">
                Email
                <input id="t-email" type="email" v-model="fields.email" required autocomplete="off" :class="input" />
            </label>
            <label class="block text-gray-700 text-sm font-bold">
                Contraseña<span v-if="fields.id" class="font-normal text-gray-500"> · vacío = no cambiar</span>
                <div class="relative">
                    <input id="t-password" :type="passwordVisible ? 'text' : 'password'" v-model="fields.password"
                           :required="!fields.id" minlength="8" autocomplete="new-password" :class="[input, 'pr-10']" />
                    <PasswordToggle :passwordVisible="passwordVisible" @toggle="passwordVisible = !passwordVisible" />
                </div>
            </label>

            <fieldset class="border-2 rounded-md p-3">
                <legend class="text-sm font-bold text-gray-700 px-1">Grupos asignados</legend>
                <label v-for="g in groups" :key="g.id" class="flex items-center gap-2 py-1">
                    <input type="checkbox" :value="g.id" v-model="fields.groupIds" /> {{ g.name }}
                </label>
            </fieldset>

            <label class="flex items-start gap-2 text-sm">
                <input id="t-admin" type="checkbox" v-model="fields.isAdmin" class="mt-1" />
                <span><b>Administrador</b>: gestiona el equipo y ve todos los grupos</span>
            </label>

            <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

            <div class="flex flex-wrap gap-2 justify-between">
                <button v-if="fields.id" type="button" @click="emit('delete', fields)"
                        class="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-2 text-sm font-bold">
                    <TrashIcon class="h-5 w-5" /> Eliminar
                </button>
                <div class="flex gap-2 ml-auto">
                    <button type="button" @click="emit('cancel')"
                            class="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" :disabled="loading"
                            class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg disabled:opacity-60">Guardar</button>
                </div>
            </div>
        </form>
    </div>
</template>

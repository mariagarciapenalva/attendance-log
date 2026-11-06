<script setup>
    import { reactive, ref, computed } from 'vue'
    import { TrashIcon, ArrowUpCircleIcon } from '@heroicons/vue/24/solid'
    import Avatar from './Avatar.vue'
    import BeltBar from './BeltBar.vue'
    import { BELT_SYSTEMS, beltInfo, beltLabel, nextRank } from '../../shared/belts.js'
    // Teachers edit name, groups and belt. Photo, username and email belong to the student.
    const props = defineProps({
        initial: { type: Object, required: true },
        groups: { type: Array, required: true },
        save: { type: Function, required: true },    // returns { success, error }
        promote: { type: Function, required: true }, // returns { success, error, student }
    })
    const emit = defineEmits(['cancel', 'delete'])

    const fields = reactive({ ...props.initial, groupIds: [...props.initial.groupIds], belt: { ...props.initial.belt } })
    const savedBelt = ref({ ...props.initial.belt })
    const progress = ref(props.initial.progress ?? null)
    const error = ref('')
    const loading = ref(false)

    const system = computed(() => BELT_SYSTEMS[fields.belt.system])
    const next = computed(() => nextRank(savedBelt.value))
    const beltChanged = computed(() => ['system', 'index', 'stripes'].some((k) => fields.belt[k] !== savedBelt.value[k]))
    const resetBelt = () => { fields.belt.index = 0; fields.belt.stripes = 0 }

    const handleSubmit = async () => {
        loading.value = true
        error.value = ''
        const result = await props.save({ id: fields.id, name: fields.name, groupIds: fields.groupIds, belt: { ...fields.belt } })
        loading.value = false
        if (!result.success) error.value = result.error
    }

    const handlePromote = async () => {
        loading.value = true
        error.value = ''
        const result = await props.promote(fields.id)
        loading.value = false
        if (result.success) {
            fields.belt = { ...result.student.belt }
            savedBelt.value = { ...result.student.belt }
            progress.value = result.student.progress
        } else {
            error.value = result.error
        }
    }
</script>

<template>
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <form @submit.prevent="handleSubmit"
              class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            <div class="flex items-center gap-4">
                <Avatar :person="fields" :size="80" />
                <div class="min-w-0">
                    <h2 class="text-xl font-semibold truncate">{{ fields.name }}</h2>
                    <p class="text-sm text-gray-500 truncate">@{{ fields.username }} · {{ fields.email }}</p>
                </div>
            </div>

            <label class="block text-gray-700 text-sm font-bold">
                Nombre
                <input id="s-name" v-model="fields.name" required
                       class="border-2 w-full p-2 mt-2 rounded-md focus:outline-none focus:border-blue-500 font-normal" />
            </label>

            <fieldset class="border-2 rounded-md p-3">
                <legend class="text-sm font-bold text-gray-700 px-1">Grupos</legend>
                <label v-for="g in groups" :key="g.id" class="flex items-center gap-2 py-1">
                    <input type="checkbox" :value="g.id" v-model="fields.groupIds" /> {{ g.name }}
                </label>
            </fieldset>

            <fieldset class="border-2 rounded-md p-3 grid gap-2">
                <legend class="text-sm font-bold text-gray-700 px-1">Cinturón</legend>
                <BeltBar :belt="fields.belt" />
                <p class="text-sm">{{ beltLabel(fields.belt) }}</p>
                <p v-if="progress && !beltChanged" class="text-xs text-gray-500">
                    {{ progress.attended }} de {{ progress.required }} clases desde el último grado (orientativo)
                </p>

                <button v-if="next && !beltChanged" type="button" @click="handlePromote" :disabled="loading"
                        :class="['flex items-center justify-center gap-1 font-bold py-2 px-3 rounded-lg text-white disabled:opacity-60',
                                 progress?.ready ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-500 hover:bg-gray-600']">
                    <ArrowUpCircleIcon class="h-5 w-5" /> Promocionar a {{ beltLabel(next) }}
                </button>

                <details class="text-sm">
                    <summary class="cursor-pointer text-indigo-800 font-medium">Corregir cinturón</summary>
                    <div class="grid gap-2 mt-2">
                        <select v-model="fields.belt.system" @change="resetBelt" class="border-2 p-2 rounded-md bg-white">
                            <option v-for="(s, key) in BELT_SYSTEMS" :key="key" :value="key">{{ s.name }}</option>
                        </select>
                        <div class="flex gap-2">
                            <select v-model.number="fields.belt.index" class="border-2 p-2 rounded-md bg-white flex-1">
                                <option v-for="(b, i) in system.belts" :key="b.name" :value="i">{{ b.name }}</option>
                            </select>
                            <select v-model.number="fields.belt.stripes" class="border-2 p-2 rounded-md bg-white">
                                <option v-for="n in system.maxStripes + 1" :key="n" :value="n - 1">{{ n - 1 }} grados</option>
                            </select>
                        </div>
                        <p class="text-xs text-gray-500">
                            Para alumnos que llegan con otro cinturón o para corregir errores.
                            Queda en el historial y reinicia el contador de clases al guardar.
                        </p>
                    </div>
                </details>
            </fieldset>

            <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

            <div class="flex flex-wrap gap-2 justify-between">
                <button type="button" @click="emit('delete', fields)"
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

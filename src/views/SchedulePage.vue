<script setup>
    import { ref, reactive, computed, onMounted } from 'vue'
    import { TrashIcon, PlusIcon } from '@heroicons/vue/24/solid'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Spinner from '../components/Spinner.vue'
    import ConfirmDeleteModal from '../components/ConfirmDeleteModal.vue'
    import { fmtTime } from '../utils/format'

    // Academy admin: the weekly timetable and the class groups students sign up for
    const { teacherState: state, fetchTeacherState, createClass, deleteClass, createGroup } = useDojo()

    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

    const form = reactive({ groupId: '', weekday: 1, start: '19:00', end: '20:00' })
    const newGroup = ref('')
    const toDelete = ref(null)
    const message = ref(null)
    const loading = ref(false)

    const groups = computed(() => state.value?.allGroups ?? [])
    const byDay = computed(() => DAYS.map((name, i) => ({
        name,
        classes: (state.value?.allClasses ?? []).filter((c) => c.weekday === i + 1).sort((a, b) => a.start - b.start),
    })))

    const run = async (fn, ok) => {
        loading.value = true
        message.value = null
        try {
            await fn()
            await fetchTeacherState()
            message.value = { ok: true, text: ok }
        } catch (e) {
            message.value = { ok: false, text: e.message }
        } finally {
            loading.value = false
        }
    }

    const addClass = () => run(() => createClass({ ...form }), 'Clase añadida')
    const addGroup = () => run(async () => { await createGroup(newGroup.value); newGroup.value = '' }, 'Grupo añadido')
    const confirmDelete = () => run(async () => { await deleteClass(toDelete.value.id); toDelete.value = null }, 'Clase eliminada del horario')

    onMounted(async () => {
        await fetchTeacherState()
        form.groupId = groups.value[0]?.id ?? ''
    })

    const input = 'border-2 p-2 rounded-md bg-white'
</script>

<template>
    <TeacherNav />
    <div class="max-w-5xl mx-auto p-4 flex flex-col gap-6">
        <h2 class="font-black text-2xl">Horario de {{ state?.academy?.name }}</h2>
        <div v-if="!state" class="flex justify-center py-20"><Spinner /></div>

        <template v-else>
            <!-- week -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <section v-for="day in byDay" :key="day.name" class="bg-white rounded-xl drop-shadow-md p-3">
                    <h3 class="font-bold mb-2">{{ day.name }}</h3>
                    <p v-if="!day.classes.length" class="text-sm text-gray-400">Sin clases</p>
                    <ul class="flex flex-col gap-1">
                        <li v-for="c in day.classes" :key="c.id" class="flex items-center justify-between gap-2 text-sm">
                            <span><span class="tabular-nums text-gray-500">{{ fmtTime(c.start) }}–{{ fmtTime(c.end) }}</span> {{ c.name }}</span>
                            <button @click="toDelete = c" class="text-gray-400 hover:text-red-600" :aria-label="`Quitar ${c.name}`">
                                <TrashIcon class="h-4 w-4" />
                            </button>
                        </li>
                    </ul>
                </section>
            </div>

            <!-- add class -->
            <form @submit.prevent="addClass" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3 max-w-xl">
                <h3 class="font-bold">Añadir clase</h3>
                <div class="flex flex-wrap gap-2">
                    <select id="c-group" v-model="form.groupId" required :class="input">
                        <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                    <select id="c-day" v-model.number="form.weekday" :class="input">
                        <option v-for="(d, i) in DAYS" :key="d" :value="i + 1">{{ d }}</option>
                    </select>
                    <input id="c-start" type="time" v-model="form.start" required :class="input" />
                    <span class="self-center">–</span>
                    <input id="c-end" type="time" v-model="form.end" required :class="input" />
                </div>
                <button :disabled="loading" class="self-start flex items-center gap-1 bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">
                    <PlusIcon class="h-5 w-5" /> Añadir al horario
                </button>
            </form>

            <!-- groups -->
            <form @submit.prevent="addGroup" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3 max-w-xl">
                <h3 class="font-bold">Grupos de clases</h3>
                <p class="text-sm text-gray-500">Son los tipos de clase que eligen los alumnos al registrarse.</p>
                <div class="flex flex-wrap gap-1">
                    <span v-for="g in groups" :key="g.id" class="text-sm bg-gray-100 rounded px-2 py-0.5">{{ g.name }}</span>
                </div>
                <div class="flex gap-2">
                    <input id="g-name" v-model="newGroup" placeholder="p. ej. No-Gi" required :class="[input, 'flex-1 min-w-0']" />
                    <button :disabled="loading" class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Añadir</button>
                </div>
            </form>

            <p v-if="message" :class="['text-sm font-medium', message.ok ? 'text-green-700' : 'text-red-600']">{{ message.text }}</p>
        </template>

        <ConfirmDeleteModal v-if="toDelete"
                            :message="`¿Quitar ${toDelete.name} del ${DAYS[toDelete.weekday - 1].toLowerCase()} a las ${fmtTime(toDelete.start)}? La asistencia pasada se conserva.`"
                            @confirm="confirmDelete" @cancel="toDelete = null" />
    </div>
</template>
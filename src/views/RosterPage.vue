<script setup>
    import { ref, computed, watch, onMounted } from 'vue'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import BeltBar from '../components/BeltBar.vue'
    import Spinner from '../components/Spinner.vue'
    import { fmtTime } from '../utils/format'

    const { teacherState: state, loadError, fetchTeacherState, saveAttendance } = useDojo()

    const classId = ref(null)
    const overrides = ref({})
    const saving = ref(false)
    const message = ref('')

    const todayClasses = computed(() => state.value
        ? state.value.classes.filter((c) => c.weekday === state.value.now.weekday).sort((a, b) => a.start - b.start)
        : [])

    // current class, else next one today, else the last one, else the demo open mat
    const defaultClassId = () => {
        const m = state.value.now.minutes
        const real = todayClasses.value.filter((c) => !c.fallback)
        return (real.find((c) => m >= c.start - 20 && m <= c.end)
            ?? real.find((c) => c.start > m)
            ?? real.at(-1)
            ?? todayClasses.value[0])?.id ?? null
    }

    const cls = computed(() => todayClasses.value.find((c) => c.id === classId.value))
    const alreadySaved = computed(() => !!cls.value && state.value.attendance.some((a) => a.classId === cls.value.id))

    const rows = computed(() => {
        if (!cls.value) return []
        const { students, attendance } = state.value
        return students
            .filter((s) => s.groupIds.includes(cls.value.groupId))
            .map((s) => {
                const saved = attendance.find((a) => a.studentId === s.id && a.classId === cls.value.id)
                const present = s.id in overrides.value ? overrides.value[s.id] : !!saved?.present
                return { student: s, present }
            })
            .sort((a, b) => b.student.rate - a.student.rate) // regulars first
    })

    const presentCount = computed(() => rows.value.filter((r) => r.present).length)
    const pendingRequests = computed(() => state.value?.requests.length ?? 0)

    const toggle = (r) => { overrides.value = { ...overrides.value, [r.student.id]: !r.present } }
    const allPresent = () => { overrides.value = Object.fromEntries(rows.value.map((r) => [r.student.id, true])) }
    watch(classId, () => { overrides.value = {} })

    const handleSave = async () => {
        saving.value = true
        try {
            await saveAttendance(cls.value.id, Object.fromEntries(rows.value.map((r) => [r.student.id, r.present])))
            overrides.value = {}
            await fetchTeacherState()
            message.value = 'Asistencia guardada'
        } catch (e) {
            message.value = e.message
        } finally {
            saving.value = false
            setTimeout(() => { message.value = '' }, 2500)
        }
    }

    onMounted(async () => {
        await fetchTeacherState()
        if (state.value) classId.value = defaultClassId()
    })
</script>

<template>
    <TeacherNav />
    <div class="max-w-5xl mx-auto p-4">
        <p v-if="loadError" class="text-red-600">{{ loadError }}</p>
        <div v-else-if="!state" class="flex justify-center py-20"><Spinner /></div>

        <template v-else>
            <router-link v-if="pendingRequests" to="/profesor/solicitudes"
                         class="block bg-amber-100 text-amber-800 rounded-xl p-3 mb-4 font-semibold">
                Tienes {{ pendingRequests }} {{ pendingRequests === 1 ? 'solicitud pendiente' : 'solicitudes pendientes' }} →
            </router-link>

            <select v-model="classId" class="border-2 p-2 rounded-md bg-white w-full sm:w-auto">
                <option v-for="c in todayClasses" :key="c.id" :value="c.id">{{ fmtTime(c.start) }} · {{ c.name }}</option>
            </select>

            <p v-if="!cls" class="mt-6 text-gray-500">Hoy no tienes clases.</p>

            <template v-else>
                <h2 class="font-black text-2xl mt-4">{{ cls.name }}</h2>
                <p class="text-gray-500">
                    {{ fmtTime(cls.start) }}–{{ fmtTime(cls.end) }} · {{ alreadySaved ? 'guardada' : 'sin guardar' }}
                </p>

                <div class="flex flex-wrap gap-2 my-3 text-sm font-semibold">
                    <span class="bg-green-100 text-green-800 rounded-full px-3 py-1">{{ presentCount }} presentes</span>
                    <span class="bg-gray-200 text-gray-700 rounded-full px-3 py-1">{{ rows.length - presentCount }} ausentes</span>
                </div>

                <div class="flex flex-wrap gap-2 mb-4">
                    <button @click="allPresent"
                            class="border-2 border-indigo-800 text-indigo-800 font-bold py-2 px-4 rounded-lg hover:bg-indigo-50">
                        Todos presentes
                    </button>
                    <button @click="handleSave" :disabled="saving"
                            class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">
                        Guardar asistencia
                    </button>
                    <span v-if="message" class="self-center text-sm text-green-700 font-medium">{{ message }}</span>
                </div>

                <p v-if="!rows.length" class="text-gray-500">No hay alumnos en este grupo.</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <button v-for="r in rows" :key="r.student.id" @click="toggle(r)" :aria-pressed="r.present"
                            :class="['bg-white rounded-xl p-3 flex flex-col items-center gap-1.5 border-2 transition',
                                     r.present ? 'border-green-600' : 'border-gray-200 opacity-60']">
                        <Avatar :person="r.student" :size="56" />
                        <span class="font-bold text-sm text-center">{{ r.student.name }}</span>
                        <BeltBar :belt="r.student.belt" />
                        <span v-if="r.student.progress?.ready" class="text-[11px] font-semibold text-amber-700">★ listo para grado</span>
                    </button>
                </div>
            </template>
        </template>
    </div>
</template>

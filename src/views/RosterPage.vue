<script setup>
    import { ref, computed, watch, onMounted, nextTick } from 'vue'
    import { useDojo, todayInDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import BeltBar from '../components/BeltBar.vue'
    import Spinner from '../components/Spinner.vue'
    import { BELT_SYSTEMS } from '../../shared/belts.js'
    import { fmtTime, fmtDate, weekdayShort, isoWeekday, shiftDate } from '../utils/format'

    const {
        teacherState: state, loadError, fetchTeacherState, fetchAttendance, saveAttendance, searchGuests,
        online, pendingCount, syncError,
    } = useDojo()

    const DAYS_BACK = 30 // same window the server accepts

    // ---------- day ----------
    const today = ref(todayInDojo())
    const selectedDate = ref(today.value)
    const isToday = computed(() => selectedDate.value === today.value)
    const dayData = ref(null) // { attendance, guests } of a past day (today comes with the main state)
    const dayLoading = ref(false)
    const dayError = ref('')
    const stripEl = ref(null)

    // last 30 days + today, oldest first (the strip scrolls to today)
    const days = computed(() => Array.from({ length: DAYS_BACK + 1 }, (_, i) => {
        const date = shiftDate(today.value, i - DAYS_BACK)
        const hasClasses = (state.value?.classes ?? []).some((c) => c.weekday === isoWeekday(date))
        return { date, hasClasses }
    }))

    const attendanceOfDay = computed(() => (isToday.value ? state.value?.attendance : dayData.value?.attendance) ?? [])
    const guestsOfDay = computed(() => (isToday.value ? state.value?.guests : dayData.value?.guests) ?? [])

    // ---------- class ----------
    const classId = ref(null)
    const overrides = ref({})
    const saving = ref(false)
    const message = ref('')

    const dayClasses = computed(() => state.value
        ? state.value.classes.filter((c) => c.weekday === isoWeekday(selectedDate.value)).sort((a, b) => a.start - b.start)
        : [])

    // today: the current class, else the next one, else the last; past days: the first class of the day
    const defaultClassId = () => {
        const list = dayClasses.value
        if (!isToday.value) return list[0]?.id ?? null
        const m = state.value.now.minutes
        return (list.find((c) => m >= c.start - 20 && m <= c.end) ?? list.find((c) => c.start > m) ?? list.at(-1))?.id ?? null
    }

    const cls = computed(() => dayClasses.value.find((c) => c.id === classId.value))
    const alreadySaved = computed(() => !!cls.value && attendanceOfDay.value.some((a) => a.classId === cls.value.id))

    // ---------- guests ----------
    const addedGuests = ref([])
    const showGuestSearch = ref(false)
    const guestQuery = ref('')
    const guestResults = ref([])
    const guestError = ref('')
    let searchTimer

    // ---------- roster ----------
    const rows = computed(() => {
        if (!cls.value) return []
        const savedHere = (id) => attendanceOfDay.value.find((a) => a.studentId === id && a.classId === cls.value.id)
        const enrolled = state.value.students.filter((s) => s.groupIds.includes(cls.value.groupId))
        // guests already saved in this class that day, plus the ones added now
        const guests = [...guestsOfDay.value.filter((g) => savedHere(g.id)), ...addedGuests.value]
            .filter((g, i, all) => all.findIndex((x) => x.id === g.id) === i && !enrolled.some((s) => s.id === g.id))
        const toRow = (s) => {
            const present = s.id in overrides.value ? overrides.value[s.id] : !!savedHere(s.id)?.present
            return { student: s, present }
        }
        return [
            ...enrolled.map(toRow).sort((a, b) => b.student.rate - a.student.rate), // regulars first
            ...guests.map(toRow),
        ]
    })

    // ---------- belt buttons: show only one belt colour ----------
    const beltFilter = ref('all') // 'all' or '<system>:<index>'
    const beltKey = (b) => `${b?.system}:${b?.index}`
    const beltChips = computed(() => {
        const chips = new Map()
        for (const r of rows.value) {
            const b = r.student.belt
            const info = BELT_SYSTEMS[b?.system]?.belts[b?.index]
            if (!info) continue
            const key = beltKey(b)
            const chip = chips.get(key) ?? {
                key, color: info.color, count: 0,
                label: info.name + (b.system === 'bjj-kids' ? ' (kids)' : ''),
                order: (b.system === 'bjj-kids' ? 100 : 0) + b.index, // adults first, then kids
            }
            chip.count++
            chips.set(key, chip)
        }
        return [...chips.values()].sort((a, b) => a.order - b.order)
    })
    const visibleRows = computed(() =>
        beltFilter.value === 'all' ? rows.value : rows.value.filter((r) => beltKey(r.student.belt) === beltFilter.value))

    const presentCount = computed(() => rows.value.filter((r) => r.present).length)
    const pendingRequests = computed(() => state.value?.requests.length ?? 0)

    const toggle = (r) => { overrides.value = { ...overrides.value, [r.student.id]: !r.present } }
    // marks the students on screen (all, or only the chosen belt)
    const allPresent = () => {
        overrides.value = { ...overrides.value, ...Object.fromEntries(visibleRows.value.map((r) => [r.student.id, true])) }
    }

    const resetClass = () => {
        overrides.value = {}; addedGuests.value = []; showGuestSearch.value = false; guestQuery.value = ''; beltFilter.value = 'all'
    }
    watch(classId, resetClass)

    // load the attendance of the chosen day
    const loadDay = async () => {
        dayError.value = ''
        if (isToday.value) { dayData.value = null; return }
        dayLoading.value = true
        try { dayData.value = await fetchAttendance(selectedDate.value) }
        catch (e) { dayData.value = { attendance: [], guests: [] }; dayError.value = e.message }
        finally { dayLoading.value = false }
    }

    const selectDay = async (date) => {
        selectedDate.value = date
        resetClass()
        await loadDay()
        classId.value = defaultClassId()
    }

    // search as you type (waits 300 ms after the last key)
    watch(guestQuery, (q) => {
        clearTimeout(searchTimer)
        guestError.value = ''
        if (q.trim().length < 2) { guestResults.value = []; return }
        searchTimer = setTimeout(async () => {
            try { guestResults.value = await searchGuests(q.trim()) }
            catch (e) { guestError.value = e.message }
        }, 300)
    })

    const addGuest = (g) => {
        if (!rows.value.some((r) => r.student.id === g.id)) addedGuests.value = [...addedGuests.value, g]
        overrides.value = { ...overrides.value, [g.id]: true } // a guest is added because they came
        guestQuery.value = ''
        guestResults.value = []
        showGuestSearch.value = false
    }

    const handleSave = async () => {
        saving.value = true
        try {
            const marks = Object.fromEntries(rows.value.map((r) => [r.student.id, r.present]))
            const { queued } = await saveAttendance(cls.value.id, marks, selectedDate.value)
            if (queued) {
                // keep the marks on screen; they will be sent when the connection comes back
                message.value = 'Guardada en el móvil. Se enviará al recuperar la conexión.'
            } else {
                await (isToday.value ? fetchTeacherState() : loadDay())
                resetClass()
                message.value = 'Asistencia guardada'
            }
        } catch (e) {
            message.value = e.message
        } finally {
            saving.value = false
            setTimeout(() => { message.value = '' }, 2500)
        }
    }

    const dayLabel = (date) => (date === today.value ? 'Hoy' : weekdayShort(date))

    onMounted(async () => {
        await fetchTeacherState()
        if (!state.value) return
        today.value = state.value.now.date ?? todayInDojo()
        selectedDate.value = today.value
        classId.value = defaultClassId()
        await nextTick()
        stripEl.value?.scrollTo({ left: stripEl.value.scrollWidth }) // show today at the right end
    })
</script>

<template>
    <TeacherNav />
    <div class="max-w-5xl mx-auto p-4">
        <p v-if="loadError" class="text-red-600">{{ loadError }}</p>
        <div v-else-if="!state" class="flex justify-center py-20"><Spinner /></div>

        <template v-else>
            <div v-if="!online || pendingCount" class="bg-gray-800 text-white rounded-xl p-3 mb-4 text-sm">
                <p v-if="!online" class="font-semibold">Sin conexión. Puedes pasar lista igualmente.</p>
                <p v-if="pendingCount">
                    {{ pendingCount }} {{ pendingCount === 1 ? 'lista pendiente' : 'listas pendientes' }} de enviar.
                    Se enviarán solas al volver internet.
                </p>
            </div>
            <p v-if="syncError" class="bg-red-100 text-red-800 rounded-xl p-3 mb-4 text-sm">{{ syncError }}</p>

            <router-link v-if="pendingRequests" to="/profesor/solicitudes"
                         class="block bg-amber-100 text-amber-800 rounded-xl p-3 mb-4 font-semibold">
                Tienes {{ pendingRequests }} {{ pendingRequests === 1 ? 'solicitud pendiente' : 'solicitudes pendientes' }} →
            </router-link>

            <!-- day strip: scroll left for past days -->
            <div ref="stripEl" class="flex gap-2 overflow-x-auto pb-2 mb-3 snap-x" role="tablist" aria-label="Día">
                <button v-for="d in days" :key="d.date" @click="selectDay(d.date)" role="tab" :aria-selected="d.date === selectedDate"
                        :class="['snap-end shrink-0 w-14 rounded-xl py-2 flex flex-col items-center border-2 text-sm',
                                 d.date === selectedDate ? 'bg-indigo-800 border-indigo-800 text-white'
                                     : d.hasClasses ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 text-gray-400']">
                    <span class="text-xs font-semibold">{{ dayLabel(d.date) }}</span>
                    <span class="font-bold tabular-nums">{{ fmtDate(d.date).split('/')[0] }}</span>
                    <span class="text-[10px] opacity-70 tabular-nums">{{ fmtDate(d.date).split('/')[1] }}</span>
                </button>
            </div>

            <p v-if="!isToday" class="bg-indigo-50 text-indigo-900 rounded-xl p-3 mb-3 text-sm">
                Estás pasando lista del <b>{{ weekdayShort(selectedDate) }} {{ fmtDate(selectedDate) }}</b>.
                <button class="underline font-semibold" @click="selectDay(today)">Volver a hoy</button>
            </p>
            <p v-if="dayError" class="text-sm text-red-600 mb-3">{{ dayError }}</p>

            <div v-if="dayLoading" class="flex justify-center py-10"><Spinner /></div>
            <p v-else-if="!dayClasses.length" class="mt-4 text-gray-500">No tienes clases este día.</p>

            <template v-else>
                <select v-model="classId" class="border-2 p-2 rounded-md bg-white w-full sm:w-auto">
                    <option v-for="c in dayClasses" :key="c.id" :value="c.id">{{ fmtTime(c.start) }} · {{ c.name }}</option>
                </select>

                <template v-if="cls">
                    <h2 class="font-black text-2xl mt-4">{{ cls.name }}</h2>
                    <p class="text-gray-500">
                        {{ weekdayShort(selectedDate) }} {{ fmtDate(selectedDate) }} · {{ fmtTime(cls.start) }}–{{ fmtTime(cls.end) }}
                        · {{ alreadySaved ? 'guardada' : 'sin guardar' }}
                    </p>

                    <div class="flex flex-wrap gap-2 my-3 text-sm font-semibold">
                        <span class="bg-green-100 text-green-800 rounded-full px-3 py-1">{{ presentCount }} presentes</span>
                        <span class="bg-gray-200 text-gray-700 rounded-full px-3 py-1">{{ rows.length - presentCount }} ausentes</span>
                    </div>

                    <div class="flex flex-wrap gap-2 mb-4">
                        <button @click="allPresent"
                                class="border-2 border-indigo-800 text-indigo-800 font-bold py-2 px-4 rounded-lg hover:bg-indigo-50">
                            {{ beltFilter === 'all' ? 'Todos presentes' : 'Todos estos presentes' }}
                        </button>
                        <button @click="handleSave" :disabled="saving"
                                class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">
                            Guardar asistencia
                        </button>
                        <span v-if="message" class="self-center text-sm text-green-700 font-medium">{{ message }}</span>
                    </div>

                    <div class="mb-4">
                        <button v-if="!showGuestSearch" @click="showGuestSearch = true"
                                class="text-sm font-semibold text-indigo-800">+ Añadir invitado (otra academia o grupo)</button>
                        <div v-else class="bg-white rounded-xl drop-shadow-md p-3 flex flex-col gap-2 max-w-md">
                            <div class="flex gap-2">
                                <input id="guest-q" v-model="guestQuery" placeholder="Nombre o usuario"
                                       class="border-2 p-2 rounded-md flex-1 min-w-0" autocomplete="off" />
                                <button @click="showGuestSearch = false; guestQuery = ''" class="text-sm text-gray-500">Cerrar</button>
                            </div>
                            <p v-if="guestError" class="text-sm text-red-600">{{ guestError }}</p>
                            <p v-else-if="guestQuery.trim().length >= 2 && !guestResults.length" class="text-sm text-gray-500">Sin resultados.</p>
                            <button v-for="g in guestResults" :key="g.id" @click="addGuest(g)"
                                    class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left">
                                <Avatar :person="g" :size="36" />
                                <span class="flex-1 min-w-0">
                                    <span class="font-semibold text-sm block truncate">{{ g.name }}</span>
                                    <span class="text-xs text-gray-500">{{ g.academyName }}</span>
                                </span>
                                <span class="w-14"><BeltBar :belt="g.belt" /></span>
                            </button>
                        </div>
                    </div>

                    <!-- one button per belt colour present in this class -->
                    <div v-if="beltChips.length > 1" class="flex gap-2 overflow-x-auto pb-2 mb-3 text-sm font-semibold" aria-label="Cinturón">
                        <button @click="beltFilter = 'all'" :aria-pressed="beltFilter === 'all'"
                                :class="['shrink-0 rounded-full px-3 py-1.5 border-2',
                                         beltFilter === 'all' ? 'bg-indigo-800 border-indigo-800 text-white' : 'bg-white border-gray-200']">
                            Todos · {{ rows.length }}
                        </button>
                        <button v-for="c in beltChips" :key="c.key" @click="beltFilter = c.key" :aria-pressed="beltFilter === c.key"
                                :class="['shrink-0 rounded-full pl-2 pr-3 py-1.5 border-2 flex items-center gap-1.5',
                                         beltFilter === c.key ? 'bg-indigo-800 border-indigo-800 text-white' : 'bg-white border-gray-200']">
                            <span class="w-5 h-2.5 rounded-sm ring-1 ring-black/20" :style="{ background: c.color }"></span>
                            {{ c.label }} · {{ c.count }}
                        </button>
                    </div>

                    <p v-if="!rows.length" class="text-gray-500">No hay alumnos en este grupo.</p>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        <button v-for="r in visibleRows" :key="r.student.id" @click="toggle(r)" :aria-pressed="r.present"
                                :class="['bg-white rounded-xl p-3 flex flex-col items-center gap-1.5 border-2 transition',
                                         r.present ? 'border-green-600' : 'border-gray-200 opacity-60']">
                            <span v-if="r.student.guest" class="text-[10px] font-bold bg-amber-100 text-amber-800 rounded px-1.5">
                                INVITADO · {{ r.student.academyName }}
                            </span>
                            <Avatar :person="r.student" :size="56" />
                            <span class="font-bold text-sm text-center">{{ r.student.name }}</span>
                            <BeltBar :belt="r.student.belt" />
                            <span v-if="r.student.progress?.ready" class="text-[11px] font-semibold text-amber-700">★ listo para grado</span>
                        </button>
                    </div>
                </template>
            </template>
        </template>
    </div>
</template>
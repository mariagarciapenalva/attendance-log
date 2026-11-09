<script setup>
    import { ref, reactive, computed, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'
    import Avatar from '../components/Avatar.vue'
    import BeltBar from '../components/BeltBar.vue'
    import Spinner from '../components/Spinner.vue'
    import { BELT_SYSTEMS, beltLabel } from '../../shared/belts.js'
    import { fmtTime, fmtDate, firstName, weekdayShort } from '../utils/format'

    const router = useRouter()
    const { logout } = useAuth()
    const { fetchMe, requestAttendance, requestTrainingOut, fetchAcademies } = useDojo()

    const me = ref(null)
    const error = ref('')
    const showForm = ref(false)
    const form = reactive({ session: '', note: '', out: false, date: '', dojo: '', place: '' })
    const dojos = ref([]) // other dojos of the app, for "I trained out"
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
    const minDate = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)
    const sending = ref(false)
    const formMsg = ref(null)

    const STATUS = {
        pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
        approved: { label: 'Aprobada', cls: 'bg-green-100 text-green-800' },
        rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-800' },
    }

    const progress = computed(() => me.value?.student.progress)
    const progressPct = computed(() => progress.value ? Math.min(100, (progress.value.attended / progress.value.required) * 100) : 0)
    const plan = computed(() => BELT_SYSTEMS[me.value?.student.belt?.system])
    const showPlan = ref(false)
    const months = (m) => (m >= 12 && m % 12 === 0 ? `${m / 12} año${m > 12 ? 's' : ''}` : `${m} meses`)

    const load = async () => {
        try {
            me.value = await fetchMe()
            dojos.value = (await fetchAcademies()).filter((a) => a.id !== me.value.student.academyId)
        } catch (e) { error.value = e.message }
    }

    const canSend = computed(() => form.out
        ? form.date && (form.dojo === 'other' ? form.place.trim() : form.dojo)
        : form.session)

    const submitRequest = async () => {
        if (!canSend.value) return
        sending.value = true
        formMsg.value = null
        try {
            if (form.out) {
                await requestTrainingOut({
                    date: form.date, note: form.note,
                    ...(form.dojo === 'other' ? { place: form.place } : { academyId: form.dojo }),
                })
            } else {
                const [classId, date] = form.session.split('|')
                await requestAttendance(classId, date, form.note)
            }
            formMsg.value = { ok: true, text: 'Solicitud enviada. Tu profe la revisará.' }
            Object.assign(form, { session: '', note: '', out: false, date: '', dojo: '', place: '' })
            showForm.value = false
            await load()
        } catch (e) {
            formMsg.value = { ok: false, text: e.message }
        } finally {
            sending.value = false
        }
    }

    const handleLogout = () => { logout(); router.push('/') }
    onMounted(load)
</script>

<template>
    <div class="max-w-md mx-auto p-4 flex flex-col gap-5">
        <div class="flex justify-between">
            <router-link to="/perfil" class="text-indigo-800 font-medium">Editar perfil</router-link>
            <button @click="handleLogout" class="text-indigo-800 font-medium">Salir</button>
        </div>

        <div v-if="error" class="flex flex-col gap-2">
            <p class="text-red-600">{{ error }}</p>
            <router-link to="/login" class="text-indigo-800 font-medium">Volver a iniciar sesión</router-link>
        </div>
        <div v-else-if="!me" class="flex justify-center py-20"><Spinner /></div>

        <template v-else>
            <section class="flex flex-col items-center gap-3 text-center">
                <Avatar :person="me.student" :size="120" />
                <h1 class="font-black text-2xl">Hola, {{ firstName(me.student.name) }}</h1>
                <div class="w-48"><BeltBar :belt="me.student.belt" /></div>
                <p class="font-semibold">{{ beltLabel(me.student.belt) }}</p>
                <div v-if="progress" class="w-full">
                    <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-800" :style="{ width: progressPct + '%' }"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-3">
                        <div class="bg-white rounded-xl drop-shadow-md p-3">
                            <p class="text-2xl font-black tabular-nums">{{ progress.toNextStripe }}</p>
                            <p class="text-xs text-gray-500">clases para el siguiente {{ progress.nextIsBelt ? 'cinturón' : 'grado' }}</p>
                        </div>
                        <div class="bg-white rounded-xl drop-shadow-md p-3">
                            <p class="text-2xl font-black tabular-nums">{{ progress.toNextBelt ?? '—' }}</p>
                            <p class="text-xs text-gray-500">clases para el siguiente cinturón</p>
                        </div>
                    </div>
                    <p v-if="progress.time.minMonths" class="text-xs mt-2" :class="progress.time.ok ? 'text-green-700' : 'text-amber-700'">
                        Tiempo mínimo en tu cinturón antes del siguiente: {{ months(progress.time.minMonths) }} · llevas {{ progress.time.months }} meses
                    </p>
                    <p class="text-xs text-gray-400 mt-1">Orientativo: tu profe decide cuándo graduarte.</p>
                </div>
            </section>

            <section v-if="plan" class="bg-white rounded-xl drop-shadow-md p-4">
                <button @click="showPlan = !showPlan" class="w-full flex justify-between font-bold">
                    Plan de graduación <span class="text-indigo-800 text-sm">{{ showPlan ? 'Ocultar' : 'Ver' }}</span>
                </button>
                <table v-if="showPlan" class="w-full text-sm mt-3">
                    <thead>
                        <tr class="text-left text-gray-500">
                            <th class="py-1 font-medium">Cinturón</th>
                            <th class="py-1 font-medium text-right">Clases / grado</th>
                            <th class="py-1 font-medium text-right">Tiempo mínimo</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        <tr v-for="(b, i) in plan.belts" :key="b.name"
                            :class="i === me.student.belt.index ? 'font-bold' : ''">
                            <td class="py-2 flex items-center gap-2">
                                <span class="w-4 h-2 rounded-sm ring-1 ring-black/20" :style="{ background: b.color }"></span>{{ b.name }}
                            </td>
                            <td class="py-2 text-right tabular-nums">{{ b.classesPerStripe }}</td>
                            <td class="py-2 text-right">{{ b.minMonths ? months(b.minMonths) : '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section>
                <h2 class="font-bold text-lg mb-2">Tus últimas clases</h2>
                <ul class="divide-y bg-white rounded-xl drop-shadow-md">
                    <li v-for="(h, i) in me.history" :key="i" class="flex justify-between gap-2 px-4 py-2">
                        <span>{{ h.className }}<span v-if="h.visit" class="text-xs text-indigo-800"> · en {{ h.visit }}</span></span>
                        <span class="text-gray-500 tabular-nums whitespace-nowrap">{{ weekdayShort(h.date) }} {{ fmtDate(h.date) }}</span>
                    </li>
                    <li v-if="!me.history.length" class="px-4 py-2 text-gray-500">Aún no hay clases registradas.</li>
                </ul>
            </section>

            <section class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-bold">¿Falta una clase en tu historial?</h2>
                    <button v-if="!showForm" @click="showForm = true" class="text-indigo-800 font-semibold text-sm">Solicitar</button>
                </div>
                <p class="text-sm text-gray-500">
                    Tu profe registra la asistencia. Si viniste a una clase y no consta, o tuviste que entrenar en otro dojo, puedes pedir que la revise.
                </p>

                <form v-if="showForm" @submit.prevent="submitRequest" class="flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 text-sm font-semibold" role="tablist">
                        <button type="button" role="tab" :aria-selected="!form.out" @click="form.out = false"
                                :class="['rounded-md py-1.5', !form.out ? 'bg-white shadow' : 'text-gray-500']">Clase de mi dojo</button>
                        <button type="button" role="tab" :aria-selected="form.out" @click="form.out = true"
                                :class="['rounded-md py-1.5', form.out ? 'bg-white shadow' : 'text-gray-500']">Entrené fuera</button>
                    </div>

                    <template v-if="!form.out">
                        <select id="req-session" v-model="form.session" class="border-2 p-2 rounded-md bg-white">
                            <option value="" disabled>Elige la clase</option>
                            <option v-for="s in me.sessions" :key="s.classId + s.date" :value="`${s.classId}|${s.date}`">
                                {{ weekdayShort(s.date) }} {{ fmtDate(s.date) }} · {{ fmtTime(s.start) }} · {{ s.name }}
                            </option>
                        </select>
                        <p v-if="!me.sessions.length" class="text-sm text-gray-500">No hay clases de las últimas 2 semanas que puedas solicitar.</p>
                    </template>

                    <template v-else>
                        <label class="text-sm font-semibold text-gray-700">Día
                            <input id="req-out-date" type="date" v-model="form.date" :min="minDate" :max="today"
                                   class="border-2 p-2 rounded-md w-full font-normal mt-1" />
                        </label>
                        <label class="text-sm font-semibold text-gray-700">¿Dónde?
                            <select id="req-out-dojo" v-model="form.dojo" class="border-2 p-2 rounded-md bg-white w-full font-normal mt-1">
                                <option value="" disabled>Elige el dojo</option>
                                <option v-for="d in dojos" :key="d.id" :value="d.id">{{ d.name }}</option>
                                <option value="other">Otro sitio…</option>
                            </select>
                        </label>
                        <input v-if="form.dojo === 'other'" id="req-out-place" v-model="form.place" maxlength="80"
                               placeholder="Nombre del dojo y ciudad" class="border-2 p-2 rounded-md" />
                    </template>
                    <textarea id="req-note" v-model="form.note" maxlength="200" rows="2" placeholder="Nota para tu profe (opcional)"
                              class="border-2 p-2 rounded-md"></textarea>
                    <div class="flex gap-2 justify-end">
                        <button type="button" @click="showForm = false" class="bg-gray-300 hover:bg-gray-400 py-2 px-4 rounded-lg">Cancelar</button>
                        <button type="submit" :disabled="sending || !canSend"
                                class="bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Enviar</button>
                    </div>
                </form>

                <p v-if="formMsg" :class="['text-sm font-medium', formMsg.ok ? 'text-green-700' : 'text-red-600']">{{ formMsg.text }}</p>

                <ul v-if="me.requests.length" class="divide-y text-sm">
                    <li v-for="r in me.requests" :key="r.id" class="py-2 flex flex-col gap-0.5">
                        <div class="flex justify-between gap-2">
                            <span>{{ weekdayShort(r.date) }} {{ fmtDate(r.date) }} · {{ r.className }}</span>
                            <span :class="['self-start rounded-full px-2 text-xs font-semibold whitespace-nowrap', STATUS[r.status].cls]">{{ STATUS[r.status].label }}</span>
                        </div>
                        <span v-if="r.reply" class="text-gray-500">Profe: {{ r.reply }}</span>
                    </li>
                </ul>
            </section>
        </template>
    </div>
</template>
<script setup>
    import { ref, reactive, onMounted } from 'vue'
    import useAuth from '../composables/useAuth'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Spinner from '../components/Spinner.vue'
    import { fmtDate } from '../utils/format'

    // Every teacher: ask to work in another dojo (as teacher or admin).
    // Admins: approve or reject the requests for their dojo, and remove access.
    const { user, isAdmin } = useAuth()
    const { fetchAccess, requestAccess, approveAccess, rejectAccess, removeAccess, fetchTeacherState, switchAcademy } = useDojo()

    const ROLES = { teacher: 'Profesor', admin: 'Administrador' }
    const STATUS = {
        pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
        approved: { label: 'Aprobada', cls: 'bg-green-100 text-green-800' },
        rejected: { label: 'Rechazada', cls: 'bg-red-100 text-red-800' },
    }

    const data = ref(null)
    const error = ref('')
    const message = ref(null)
    const busy = ref(false)
    const form = reactive({ academyId: '', role: 'teacher', note: '' })
    const picks = ref({}) // groups chosen per incoming request

    const load = async () => {
        try {
            data.value = await fetchAccess()
            // a request was approved since logging in: refresh the session so the new dojo shows in the selector
            const members = data.value.academies.filter((a) => a.status === 'member').length
            if (members !== (user.value?.academies?.length ?? 1)) {
                await switchAcademy(user.value.academyId)
                fetchTeacherState()
            }
        } catch (e) { error.value = e.message }
    }

    const run = async (fn, ok) => {
        busy.value = true
        message.value = null
        try {
            await fn()
            message.value = { ok: true, text: ok }
            await load()
            fetchTeacherState() // refresh the badge
        } catch (e) {
            message.value = { ok: false, text: e.message }
        } finally {
            busy.value = false
        }
    }

    const send = () => run(async () => {
        await requestAccess(form.academyId, form.role, form.note)
        Object.assign(form, { academyId: '', role: 'teacher', note: '' })
    }, 'Solicitud enviada. El administrador de ese dojo la revisará.')

    const approve = (r) => run(() => approveAccess(r.id, picks.value[r.id] ?? []), `${r.teacherName} ya puede entrar en tu dojo`)
    const reject = (r) => run(() => rejectAccess(r.id), 'Solicitud rechazada')
    const remove = (v) => run(() => removeAccess(v.id), `Acceso de ${v.name} retirado`)

    onMounted(load)
</script>

<template>
    <TeacherNav />
    <div class="max-w-3xl mx-auto p-4 flex flex-col gap-5">
        <h2 class="font-black text-2xl">Dojos</h2>
        <p class="text-sm text-gray-500 -mt-3">
            Cada profesor entra en su dojo. Para trabajar en otro, pide acceso: lo aprueba el administrador de ese dojo.
            Cuando tengas varios, cámbialos desde el selector de arriba.
        </p>
        <p v-if="error" class="text-red-600">{{ error }}</p>
        <p v-if="message" :class="['text-sm font-medium', message.ok ? 'text-green-700' : 'text-red-600']">{{ message.text }}</p>

        <div v-if="!data && !error" class="flex justify-center py-20"><Spinner /></div>

        <template v-else-if="data">
            <!-- incoming (admins) -->
            <section v-if="isAdmin()" class="flex flex-col gap-3">
                <h3 class="font-bold text-lg">Solicitudes para tu dojo</h3>
                <p v-if="!data.incoming.length" class="bg-white rounded-xl p-4 text-gray-500 text-sm">No hay solicitudes pendientes.</p>
                <article v-for="r in data.incoming" :key="r.id" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3">
                    <div>
                        <p class="font-bold">{{ r.teacherName }} <span class="font-normal text-gray-500">@{{ r.teacherUsername }} · {{ r.fromAcademy }}</span></p>
                        <p class="text-sm">Pide entrar como <b>{{ ROLES[r.role] }}</b> · {{ fmtDate(r.createdAt.slice(0, 10)) }}</p>
                    </div>
                    <p v-if="r.note" class="text-sm bg-gray-50 rounded-lg p-2">“{{ r.note }}”</p>
                    <fieldset v-if="r.role === 'teacher'" class="text-sm">
                        <legend class="text-gray-500 mb-1">Grupos que llevará (si no marcas ninguno, todos)</legend>
                        <label v-for="g in data.groups" :key="g.id" class="inline-flex items-center gap-1 mr-3">
                            <input type="checkbox" :value="g.id" v-model="picks[r.id]" @click="picks[r.id] ??= []" /> {{ g.name }}
                        </label>
                    </fieldset>
                    <div class="flex gap-2 justify-end">
                        <button @click="reject(r)" :disabled="busy"
                                class="bg-gray-200 hover:bg-gray-300 font-semibold py-2 px-4 rounded-lg disabled:opacity-60">Rechazar</button>
                        <button @click="approve(r)" :disabled="busy"
                                class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Aprobar</button>
                    </div>
                </article>

                <div v-if="data.visitors.length" class="bg-white rounded-xl drop-shadow-md p-4">
                    <h4 class="font-semibold mb-2">Profesores de otros dojos con acceso</h4>
                    <ul class="divide-y text-sm">
                        <li v-for="v in data.visitors" :key="v.id" class="py-2 flex items-center justify-between gap-2">
                            <span>{{ v.name }} <span class="text-gray-500">· {{ v.fromAcademy }} · {{ v.isAdmin ? 'admin' : 'profesor' }}</span></span>
                            <button @click="remove(v)" :disabled="busy" class="text-red-600 font-semibold">Quitar</button>
                        </li>
                    </ul>
                </div>
            </section>

            <!-- ask for access -->
            <form @submit.prevent="send" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3">
                <h3 class="font-bold">Pedir acceso a otro dojo</h3>
                <div class="flex flex-wrap gap-2">
                    <select id="acc-dojo" v-model="form.academyId" required class="border-2 p-2 rounded-md bg-white">
                        <option value="" disabled>Dojo</option>
                        <option v-for="a in data.academies" :key="a.id" :value="a.id" :disabled="a.status === 'pending'">
                            {{ a.name }}{{ a.status === 'member' ? ' (ya tienes acceso)' : a.status === 'pending' ? ' (pendiente)' : '' }}
                        </option>
                    </select>
                    <select id="acc-role" v-model="form.role" class="border-2 p-2 rounded-md bg-white">
                        <option value="teacher">como Profesor</option>
                        <option value="admin">como Administrador</option>
                    </select>
                </div>
                <input id="acc-note" v-model="form.note" maxlength="200" placeholder="Mensaje para el administrador (opcional)"
                        class="border-2 p-2 rounded-md text-sm" />
                <button :disabled="busy || !form.academyId"
                        class="self-start bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">
                    Enviar solicitud
                </button>
                <p class="text-xs text-gray-500">Cuando la aprueben, el dojo aparecerá en el selector de arriba al volver a esta página.</p>
            </form>

            <!-- my requests -->
            <section v-if="data.mine.length" class="bg-white rounded-xl drop-shadow-md p-4">
                <h3 class="font-bold mb-2">Tus solicitudes</h3>
                <ul class="divide-y text-sm">
                    <li v-for="r in data.mine" :key="r.id" class="py-2 flex justify-between gap-2">
                        <span>{{ r.academyName }} · {{ ROLES[r.role] }}</span>
                        <span :class="['self-start rounded-full px-2 text-xs font-semibold whitespace-nowrap', STATUS[r.status].cls]">{{ STATUS[r.status].label }}</span>
                    </li>
                </ul>
            </section>
        </template>
    </div>
</template>
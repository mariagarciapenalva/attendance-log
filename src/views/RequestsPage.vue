<script setup>
    import { ref, computed, onMounted } from 'vue'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import Spinner from '../components/Spinner.vue'
    import { fmtTime, fmtDate, weekdayShort } from '../utils/format'

    const { teacherState: state, fetchTeacherState, approveRequest, rejectRequest } = useDojo()

    const replies = ref({})
    const busy = ref(null)
    const error = ref('')

    const items = computed(() => {
        if (!state.value) return []
        return state.value.requests
            .map((r) => ({
                ...r,
                student: state.value.students.find((s) => s.id === r.studentId),
                cls: state.value.classes.find((c) => c.id === r.classId),
            }))
            .filter((r) => r.student && r.cls)
            .sort((a, b) => a.date.localeCompare(b.date))
    })

    const resolve = async (r, approve) => {
        busy.value = r.id
        error.value = ''
        try {
            approve ? await approveRequest(r.id) : await rejectRequest(r.id, replies.value[r.id] ?? '')
            await fetchTeacherState()
        } catch (e) {
            error.value = e.message
        } finally {
            busy.value = null
        }
    }

    onMounted(fetchTeacherState)
</script>

<template>
    <TeacherNav />
    <div class="max-w-3xl mx-auto p-4 flex flex-col gap-3">
        <h2 class="font-black text-2xl">Solicitudes de registro</h2>
        <p class="text-gray-500 text-sm">Alumnos que dicen haber venido a una clase donde no constan. Si apruebas, la clase cuenta para su cinturón.</p>
        <p v-if="error" class="text-red-600">{{ error }}</p>

        <div v-if="!state" class="flex justify-center py-20"><Spinner /></div>
        <p v-else-if="!items.length" class="bg-white rounded-xl p-6 text-center text-gray-500">No hay solicitudes pendientes.</p>

        <article v-for="r in items" :key="r.id" class="bg-white rounded-xl drop-shadow-md p-4 flex flex-col gap-3">
            <div class="flex items-center gap-3">
                <Avatar :person="r.student" :size="48" />
                <div class="min-w-0">
                    <p class="font-bold">{{ r.student.name }}</p>
                    <p class="text-sm text-gray-600">{{ weekdayShort(r.date) }} {{ fmtDate(r.date) }} · {{ fmtTime(r.cls.start) }} · {{ r.cls.name }}</p>
                </div>
            </div>
            <p v-if="r.note" class="text-sm bg-gray-50 rounded-lg p-2">“{{ r.note }}”</p>
            <input v-model="replies[r.id]" maxlength="200" placeholder="Respuesta (opcional, la ve el alumno)"
                   class="border-2 p-2 rounded-md text-sm" />
            <div class="flex gap-2 justify-end">
                <button @click="resolve(r, false)" :disabled="busy === r.id"
                        class="bg-gray-200 hover:bg-gray-300 font-semibold py-2 px-4 rounded-lg disabled:opacity-60">Rechazar</button>
                <button @click="resolve(r, true)" :disabled="busy === r.id"
                        class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-60">Aprobar</button>
            </div>
        </article>
    </div>
</template>

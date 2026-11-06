<script setup>
    import { ref, computed, onMounted } from 'vue'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import BeltBar from '../components/BeltBar.vue'
    import Spinner from '../components/Spinner.vue'
    import StudentModal from '../components/StudentModal.vue'
    import ConfirmDeleteModal from '../components/ConfirmDeleteModal.vue'

    const { teacherState: state, fetchTeacherState, updateStudent, deleteStudent, promoteStudent } = useDojo()

    const editing = ref(null)
    const toDelete = ref(null)
    const groupFilter = ref('all')

    const isNew = (s) => state.value && s.createdAt && (new Date(state.value.now.date) - new Date(s.createdAt)) / 864e5 <= 14

    const students = computed(() =>
        (state.value?.students ?? [])
            .filter((s) => groupFilter.value === 'all' || s.groupIds.includes(groupFilter.value))
            .sort((a, b) => (isNew(b) - isNew(a)) || a.name.localeCompare(b.name)))

    const handleSave = async (student) => {
        try {
            await updateStudent(student.id, student)
            await fetchTeacherState()
            editing.value = null
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    const handlePromote = async (id) => {
        try {
            const student = await promoteStudent(id)
            await fetchTeacherState()
            return { success: true, student }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    const handleDelete = async () => {
        await deleteStudent(toDelete.value.id)
        toDelete.value = null
        editing.value = null
        await fetchTeacherState()
    }

    onMounted(fetchTeacherState)
</script>

<template>
    <TeacherNav />
    <div class="max-w-5xl mx-auto p-4">
        <div class="flex flex-wrap gap-2 items-center justify-between mb-4">
            <select v-model="groupFilter" class="border-2 p-2 rounded-md bg-white">
                <option value="all">Todos mis grupos</option>
                <option v-for="g in state?.groups ?? []" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <p class="text-sm text-gray-500">Los alumnos se dan de alta ellos mismos desde «Crear cuenta».</p>
        </div>

        <div v-if="!state" class="flex justify-center py-20"><Spinner /></div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <button v-for="s in students" :key="s.id" @click="editing = { ...s }"
                    class="relative bg-white drop-shadow-md rounded-xl p-3 flex flex-col items-center gap-2 hover:ring-2 hover:ring-indigo-800">
                <span v-if="isNew(s)" class="absolute top-1.5 left-1.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded px-1.5">NUEVO</span>
                <Avatar :person="s" :size="64" />
                <span class="font-semibold text-sm text-center">{{ s.name }}</span>
                <BeltBar :belt="s.belt" />
                <span v-if="s.progress" class="text-xs text-gray-500 font-mono">{{ s.progress.attended }}/{{ s.progress.required }} clases</span>
                <span v-if="s.progress?.ready" class="text-[11px] font-semibold text-amber-700">★ listo para grado</span>
            </button>
        </div>

        <StudentModal v-if="editing" :initial="editing" :groups="state.groups" :save="handleSave" :promote="handlePromote"
                      @cancel="editing = null" @delete="toDelete = $event" />
        <ConfirmDeleteModal v-if="toDelete" message="¿Seguro que quieres eliminar a este alumno?"
                            @confirm="handleDelete" @cancel="toDelete = null" />
    </div>
</template>

<script setup>
    import { ref, onMounted } from 'vue'
    import { PlusIcon } from '@heroicons/vue/24/solid'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import Spinner from '../components/Spinner.vue'
    import TeacherModal from '../components/TeacherModal.vue'
    import ConfirmDeleteModal from '../components/ConfirmDeleteModal.vue'

    const { teacherState: state, fetchTeacherState, createTeacher, updateTeacher, deleteTeacher } = useDojo()

    const editing = ref(null)
    const toDelete = ref(null)
    const error = ref('')

    const groupName = (id) => state.value?.allGroups?.find((g) => g.id === id)?.name ?? id

    const openNew = () => {
        editing.value = { name: '', username: '', email: '', password: '', groupIds: [], isAdmin: false, photo: null }
    }
    const openEdit = (t) => { editing.value = { ...t, password: '' } }

    const handleSave = async (t) => {
        try {
            t.id ? await updateTeacher(t.id, t) : await createTeacher(t)
            await fetchTeacherState()
            editing.value = null
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    }

    const handleDelete = async () => {
        error.value = ''
        try {
            await deleteTeacher(toDelete.value.id)
            editing.value = null
            await fetchTeacherState()
        } catch (e) {
            error.value = e.message
        } finally {
            toDelete.value = null
        }
    }

    onMounted(fetchTeacherState)
</script>

<template>
    <TeacherNav />
    <div class="max-w-5xl mx-auto p-4">
        <button @click="openNew"
                class="flex items-center gap-1 bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg mb-4">
            <PlusIcon class="h-5 w-5" /> Añadir profesor
        </button>
        <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

        <div v-if="!state?.teachers" class="flex justify-center py-20"><Spinner /></div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <button v-for="t in state.teachers" :key="t.id" @click="openEdit(t)"
                    class="bg-white drop-shadow-md rounded-xl p-4 flex items-center gap-3 text-left hover:ring-2 hover:ring-indigo-800">
                <Avatar :person="t" :size="56" />
                <div class="min-w-0 flex flex-col gap-1">
                    <p class="font-bold">
                        {{ t.name }}
                        <span v-if="t.isAdmin" class="ml-1 text-[10px] bg-indigo-100 text-indigo-800 rounded px-1.5 align-middle">ADMIN</span>
                    </p>
                    <p class="text-xs text-gray-500 truncate">@{{ t.username }}</p>
                    <div class="flex flex-wrap gap-1">
                        <span v-for="g in t.groupIds" :key="g" class="text-xs bg-gray-100 rounded px-1.5">{{ groupName(g) }}</span>
                    </div>
                </div>
            </button>
        </div>

        <TeacherModal v-if="editing" :initial="editing" :groups="state.allGroups" :save="handleSave"
                      @cancel="editing = null" @delete="toDelete = $event" />
        <ConfirmDeleteModal v-if="toDelete" message="¿Seguro que quieres eliminar a este profesor?"
                            @confirm="handleDelete" @cancel="toDelete = null" />
    </div>
</template>

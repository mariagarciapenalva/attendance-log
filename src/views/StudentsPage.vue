<script setup>
    import { ref, computed, onMounted } from 'vue'
    import { useDojo } from '../composables/useDojo'
    import TeacherNav from '../components/TeacherNav.vue'
    import Avatar from '../components/Avatar.vue'
    import BeltBar from '../components/BeltBar.vue'
    import Spinner from '../components/Spinner.vue'
    import StudentModal from '../components/StudentModal.vue'
    import ConfirmDeleteModal from '../components/ConfirmDeleteModal.vue'
    import { BELT_SYSTEMS, beltLabel } from '../../shared/belts.js'

    const { teacherState: state, fetchTeacherState, updateStudent, deleteStudent, promoteStudent } = useDojo()

    const editing = ref(null)
    const toDelete = ref(null)
    const groupFilter = ref('all')  // class group
    const beltFilter = ref('all')   // "system|index", e.g. "bjj-adult|1" = blue
    const groupBy = ref('rank')     // 'rank' = by belt and stripes, 'none' = one list

    const SYSTEM_ORDER = Object.keys(BELT_SYSTEMS) // adults first, then kids

    const isNew = (s) => state.value && s.createdAt && (new Date(state.value.now.date) - new Date(s.createdAt)) / 864e5 <= 14

    // belt options for the filter, e.g. "BJJ adultos · Azul"
    const beltOptions = computed(() =>
        SYSTEM_ORDER.flatMap((sys) => BELT_SYSTEMS[sys].belts.map((b, i) => ({
            value: `${sys}|${i}`, label: `${BELT_SYSTEMS[sys].name} · ${b.name}`,
        }))))

    const students = computed(() =>
        (state.value?.students ?? [])
            .filter((s) => groupFilter.value === 'all' || s.groupIds.includes(groupFilter.value))
            .filter((s) => beltFilter.value === 'all' || `${s.belt?.system}|${s.belt?.index}` === beltFilter.value))

    // Categories: one section per belt + stripes, highest rank first (adults, then kids)
    const sections = computed(() => {
        if (groupBy.value === 'none') {
            const list = [...students.value].sort((a, b) => (isNew(b) - isNew(a)) || a.name.localeCompare(b.name))
            return [{ key: 'all', title: null, belt: null, students: list }]
        }
        const map = new Map()
        for (const s of students.value) {
            const key = s.belt ? `${s.belt.system}|${s.belt.index}|${s.belt.stripes}` : 'none'
            if (!map.has(key)) map.set(key, { key, belt: s.belt, students: [] })
            map.get(key).students.push(s)
        }
        const rank = (belt) => belt
            ? [SYSTEM_ORDER.indexOf(belt.system), -belt.index, -belt.stripes]
            : [99, 0, 0]
        return [...map.values()]
            .map((sec) => ({
                ...sec,
                title: sec.belt ? `${BELT_SYSTEMS[sec.belt.system].name} · ${beltLabel(sec.belt)}` : 'Sin cinturón',
                students: sec.students.sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) => {
                const [x, y] = [rank(a.belt), rank(b.belt)]
                return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
            })
    })

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
        <div class="flex flex-wrap gap-2 items-center mb-2">
            <select id="f-group" v-model="groupFilter" class="border-2 p-2 rounded-md bg-white">
                <option value="all">Todas mis clases</option>
                <option v-for="g in state?.groups ?? []" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <select id="f-belt" v-model="beltFilter" class="border-2 p-2 rounded-md bg-white">
                <option value="all">Todos los cinturones</option>
                <option v-for="o in beltOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <div class="flex rounded-lg border-2 overflow-hidden text-sm font-medium">
                <button :class="['px-3 py-2', groupBy === 'rank' ? 'bg-indigo-800 text-white' : 'bg-white']"
                        @click="groupBy = 'rank'">Por cinturón</button>
                <button :class="['px-3 py-2', groupBy === 'none' ? 'bg-indigo-800 text-white' : 'bg-white']"
                        @click="groupBy = 'none'">Lista</button>
            </div>
        </div>
        <p class="text-sm text-gray-500 mb-4">Los alumnos se dan de alta ellos mismos desde «Crear cuenta».</p>

        <div v-if="!state" class="flex justify-center py-20"><Spinner /></div>
        <p v-else-if="!students.length" class="text-gray-500">No hay alumnos con estos filtros.</p>

        <section v-for="sec in sections" :key="sec.key" class="mb-6">
            <header v-if="sec.title" class="flex items-center gap-3 mb-2">
                <div v-if="sec.belt" class="w-16"><BeltBar :belt="sec.belt" /></div>
                <h2 class="font-bold">{{ sec.title }}</h2>
                <span class="text-sm text-gray-500">{{ sec.students.length }}</span>
            </header>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <button v-for="s in sec.students" :key="s.id" @click="editing = { ...s }"
                        class="relative bg-white drop-shadow-md rounded-xl p-3 flex flex-col items-center gap-2 hover:ring-2 hover:ring-indigo-800">
                    <span v-if="isNew(s)" class="absolute top-1.5 left-1.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded px-1.5">NUEVO</span>
                    <Avatar :person="s" :size="64" />
                    <span class="font-semibold text-sm text-center">{{ s.name }}</span>
                    <BeltBar :belt="s.belt" />
                    <span v-if="s.progress" class="text-xs text-gray-500 font-mono">{{ s.progress.attended }}/{{ s.progress.required }} clases</span>
                    <span v-if="s.progress?.ready" class="text-[11px] font-semibold text-amber-700">★ listo para grado</span>
                </button>
            </div>
        </section>

        <StudentModal v-if="editing" :initial="editing" :groups="state.groups" :save="handleSave" :promote="handlePromote"
                    @cancel="editing = null" @delete="toDelete = $event" />
        <ConfirmDeleteModal v-if="toDelete" message="¿Seguro que quieres eliminar a este alumno?"
                            @confirm="handleDelete" @cancel="toDelete = null" />
    </div>
</template>
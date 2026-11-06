<script setup>
    import { computed } from 'vue'
    import { BELT_SYSTEMS, beltLabel } from '../../shared/belts.js'

    // A real BJJ belt: belt colour, black rank bar (red on the top belt) and white stripes
    const props = defineProps({ belt: Object })

    const sys = computed(() => BELT_SYSTEMS[props.belt?.system])
    const color = computed(() => sys.value?.belts[props.belt.index]?.color ?? '#e5e7eb')
    const isTopBelt = computed(() => sys.value && props.belt.index === sys.value.belts.length - 1)
</script>

<template>
    <div v-if="sys" class="w-full" :title="beltLabel(belt)">
        <div class="flex h-3 w-full rounded-sm overflow-hidden ring-1 ring-black/20">
            <div class="flex-1" :style="{ background: color }"></div>
            <div class="w-2/5 flex items-center justify-end gap-0.5 px-1"
                 :style="{ background: isTopBelt ? '#b91c1c' : '#111827' }">
                <span v-for="i in belt.stripes" :key="i" class="w-1 h-2 bg-white rounded-[1px]"></span>
            </div>
        </div>
    </div>
</template>

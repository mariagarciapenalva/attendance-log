<script setup>
    import { computed } from 'vue'

    // Shows the person's photo, or coloured initials as a placeholder
    const props = defineProps({
        person: { type: Object, required: true }, // { id?, name, photo? }
        size: { type: Number, default: 64 },
    })

    const initials = computed(() =>
        (props.person.name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())
    const hue = computed(() =>
        [...(props.person.id || props.person.name || 'x')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7))
    const box = computed(() => ({
        width: `${props.size}px`, height: `${props.size}px`, fontSize: `${props.size * 0.38}px`,
    }))
</script>

<template>
    <img v-if="person.photo" :src="person.photo" alt="" :style="box" class="rounded-full object-cover shrink-0" />
    <span v-else
          :style="{ ...box, background: `hsl(${hue} 55% 86%)`, color: `hsl(${hue} 50% 28%)` }"
          class="rounded-full grid place-items-center font-black shrink-0 select-none">{{ initials }}</span>
</template>

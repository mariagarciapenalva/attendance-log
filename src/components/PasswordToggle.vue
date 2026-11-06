<script setup>
    import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/solid';
    import {defineProps, defineEmits} from 'vue'

    const props = defineProps({
        passwordVisible: {
            type: Boolean,
            default: false
        }
    })
    const emit = defineEmits(['toggle'])
    const toggleVisibility =()=>{
        emit('toggle')
    }
</script>
<template>
    <button
        type="button"
        class="absolute right-3 inset-y-0 my-auto text-gray-600"
        @click="toggleVisibility"
    >
        <EyeIcon v-if="!passwordVisible" class="h-5 w-5" />
        <EyeSlashIcon v-else class="h-5 w-5" />
    </button>
</template>
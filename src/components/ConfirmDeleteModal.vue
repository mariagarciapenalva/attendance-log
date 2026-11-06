<script setup>
    defineProps({ message: { type: String, default: '¿Seguro que quieres eliminarlo?' } })
    const emit = defineEmits(['confirm', 'cancel'])
</script>
<template>
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div class="bg-white p-6 rounded-lg shadow-lg text-center animate-fadeIn">
            <h2 class="text-xl font-semibold mb-4">{{ message }}</h2>
            <div class="flex justify-center gap-4">
                <button
                    @click="emit('confirm')"
                    class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg"
                > Sí, eliminar
                </button>
                <button
                    @click="emit('cancel')"
                    class="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded-lg"
                >
                    Cancelar
                </button>
            </div>
        </div>
    </div>
</template>
<style scoped>
    .animate-fadeIn { animation: fadeIn .2s ease-out }
    @keyframes fadeIn{
        from{ opacity:0; transform: translateY(-10px); }
        to{ opacity: 1; transform: translateY(0); }
    }
</style>

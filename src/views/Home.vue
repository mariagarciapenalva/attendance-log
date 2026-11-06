<template>
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-sm flex flex-col gap-4 text-center">
            <h1 class="font-black text-3xl">Dojo · Asistencia</h1>
            <p class="text-gray-600">Registro de asistencia y cinturones</p>
            <router-link to="/login"
                         class="bg-indigo-800 hover:bg-indigo-900 text-white text-xl font-bold py-4 rounded-xl">Iniciar sesión</router-link>
            <router-link to="/register"
                         class="border-2 border-indigo-800 text-indigo-800 text-xl font-bold py-4 rounded-xl hover:bg-indigo-50">Crear cuenta de alumno</router-link>
            <div class="text-sm text-gray-500 leading-relaxed bg-white rounded-xl p-3 text-left">
                <p class="font-semibold text-gray-700 mb-1">Cuentas de demostración (contraseña: <code>demo1234</code>)</p>
                <p>Profesor admin: <code>sensei</code> · Profesor: <code>profe1</code></p>
                <p>Alumnos: <code>laia</code>, <code>aitana</code>, <code>bruno</code>…</p>
            </div>
        </div>
    </div>
</template>
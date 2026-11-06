// Same origin as the site: the API is the Netlify Function at /api/*
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '') + '/api'

export const headers = (token = null) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
})

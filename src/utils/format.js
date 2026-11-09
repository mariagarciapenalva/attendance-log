export const fmtTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const fmtDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/')
export const firstName = (n) => n.split(' ')[0]
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const weekdayShort = (iso) => DAYS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7]
// ISO weekday of a YYYY-MM-DD date: 1 = Monday ... 7 = Sunday
export const isoWeekday = (iso) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1
// YYYY-MM-DD shifted by n days
export const shiftDate = (iso, n) => {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}
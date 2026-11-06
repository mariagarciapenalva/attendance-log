// Crops to a square and shrinks the photo in the browser (~20-30 KB instead of several MB)
export function resizeImage(file, size = 256) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const s = Math.min(img.width, img.height)
            const canvas = document.createElement('canvas')
            canvas.width = canvas.height = size
            canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
            URL.revokeObjectURL(img.src)
            resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.onerror = reject
        img.src = URL.createObjectURL(file)
    })
}

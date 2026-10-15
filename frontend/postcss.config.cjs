// Vite ส่ง global.css ให้ PostCSS → Tailwind ขยาย @tailwind เป็น CSS → Autoprefixer เติมรูปแบบรองรับ Browser
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

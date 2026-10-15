// PostCSS/Tailwind อ่าน content เพื่อหา class ใน JSX/HTML → สร้าง CSS utility; primary เป็นสีที่ใช้ผ่าน class ของ Tailwind
module.exports = { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { colors: { primary: '#C92720' } } }, plugins: [] };

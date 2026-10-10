import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// One external entity per role and one process. Each feature has two data flows.
const flows = [
  ['สมัครสมาชิก', 'ชื่อ อีเมล และรหัสผ่าน', 'ผลสมัครสมาชิก และข้อมูลบัญชี'],
  ['เข้าสู่ระบบ', 'อีเมล และรหัสผ่าน', 'ข้อมูลผู้ใช้ และ cookie ของ session'],
  ['ดูข้อมูลบัญชี / ตรวจสถานะเข้าสู่ระบบ', 'session ของผู้ใช้งาน', 'ข้อมูลบัญชี หรือสถานะยังไม่ได้เข้าสู่ระบบ'],
  ['แก้ไขชื่อผู้ใช้', 'session และชื่อใหม่', 'ข้อมูลบัญชีที่แก้ไขแล้ว'],
  ['ออกจากระบบ', 'session ที่ต้องการยกเลิก', 'ผลออกจากระบบ และการล้าง cookie'],
  ['สร้าง Short URL', 'session, URL ต้นฉบับ, ชื่อย่อ และวันหมดอายุ (ถ้าระบุ)', 'Short URL และข้อมูลลิงก์ที่สร้าง'],
  ['เปิด–ปิดลิงก์ / แก้วันหมดอายุ', 'session, รหัสลิงก์, สถานะ และ/หรือวันหมดอายุใหม่', 'สถานะ และวันหมดอายุที่บันทึกแล้ว'],
  ['สร้าง / ดาวน์โหลด QR Code', 'session, รหัสลิงก์ และรูปแบบ PNG หรือ SVG', 'ภาพ QR Code ที่เข้ารหัส Short URL'],
  ['ดูประวัติ / ค้นหา / แบ่งหน้า', 'session, คำค้น, ตัวกรองสถานะ และเลขหน้า', 'URL ต้นฉบับ, Short URL, สถานะ และยอดคลิกสะสม'],
  ['ดูแดชบอร์ด / สถิติ', 'session, ช่วงวันที่ และรหัสลิงก์ (ถ้าระบุ)', 'จำนวนลิงก์, ยอดคลิก, กราฟรายวัน, อุปกรณ์ และแหล่งที่มา'],
  ['เปิด Short URL / สแกน QR Code', 'รหัสลิงก์, GET/HEAD, ข้อมูลเบราว์เซอร์ และแหล่งที่มา (ถ้ามี)', 'URL ปลายทางพร้อม HTTP 302 หรือผลไม่พบ / ปิด / หมดอายุ'],
];
const code = n => `F${String(n).padStart(2, '0')}`;
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const directory = resolve('docs/diagrams');
const width = 1840, height = 1900, top = 282, step = 126;
const ownerBottom = top + 10 * step - 12;
const publicTop = top + 10 * step + 20;
const processBottom = top + 11 * step + 8;
const text = (x, y, s, size = 20, fill = '#243249', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
const center = (x, y, s, size = 20, fill = '#243249', extra = '') => text(x, y, s, size, fill, `text-anchor="middle" ${extra}`);
const person = (x, y, color) => `<g stroke="${color}" stroke-width="3" fill="none"><circle cx="${x}" cy="${y}" r="22"/><path d="M${x - 42},${y + 76} v-14 a42,42 0 0 1 84,0 v14"/></g>`;
const arrow = (y, label, n, input) => {
  const color = input ? '#2563b5' : '#087f78';
  return `<g data-flow="${code(n)}"><rect x="378" y="${y - 35}" width="61" height="27" rx="5" fill="${input ? '#eaf1fc' : '#e5f4f0'}"/>
    ${center(408, y - 16, code(n), 14, color, 'font-weight="700"')}
    ${text(452, y - 15, label, 19, color)}
    <path d="M${input ? 324 : 1488},${y} H${input ? 1488 : 324}" fill="none" stroke="${color}" stroke-width="2.1" marker-end="url(#${input ? 'in' : 'out'})"/>
  </g>`;
};
const rows = flows.map(([title, request, response], i) => {
  const y = top + i * step + (i === 10 ? 20 : 0);
  return `<g>${i % 2 === 0 ? `<rect x="365" y="${y}" width="1082" height="117" rx="8" fill="#f4f7fb"/>` : ''}
    ${text(378, y + 24, `${String(i + 1).padStart(2, '0')}  ${title}`, 20, '#172b47', 'font-weight="700"')}
    ${arrow(y + 65, request, i * 2 + 1, true)}
    ${arrow(y + 110, response, i * 2 + 2, false)}
  </g>`;
}).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Context Diagram — ระบบ Short URL: ข้อมูลเข้าและออกแยกทุกฟังก์ชัน</title>
  <desc id="description">ผู้ใช้งาน E1 และผู้เปิดลิงก์ E2 ติดต่อกับระบบเดียว Process 0 ผ่านลูกศร 22 เส้น สีฟ้าคือข้อมูลเข้าระบบ สีเขียวคือผลลัพธ์ที่ส่งกลับ</desc>
  <defs>
    <marker id="in" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#2563b5"/></marker>
    <marker id="out" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#087f78"/></marker>
  </defs>
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <g font-family="Tahoma, sans-serif">
    <rect x="56" y="46" width="5" height="100" rx="2" fill="#d32c25"/>
    ${text(80, 67, 'SYSTEM DESIGN  /  DATA FLOW DIAGRAM', 15, '#64748b', 'letter-spacing="2"')}
    ${text(80, 111, 'Context Diagram — ระบบ Short URL', 34, '#16263d', 'font-weight="700"')}
    ${text(80, 147, 'ภาพรวมขอบเขตระบบ · แยกข้อมูลเข้าและผลลัพธ์ของแต่ละฟังก์ชัน', 20, '#526277')}
    <path d="M80 196 H144" stroke="#2563b5" stroke-width="2.2" marker-end="url(#in)"/>
    ${text(161, 202, 'ข้อมูลส่งเข้าระบบ', 18, '#2563b5')}
    <path d="M465 196 H401" stroke="#087f78" stroke-width="2.2" marker-end="url(#out)"/>
    ${text(482, 202, 'ผลลัพธ์ส่งกลับผู้ใช้', 18, '#087f78')}
    ${text(1075, 202, '11 ฟังก์ชัน  ·  22 เส้นข้อมูล  ·  1 ระบบ', 18, '#526277')}
    <line x1="56" y1="226" x2="1784" y2="226" stroke="#dbe3ed"/>
    ${center(190, 259, 'EXTERNAL ENTITY', 13, '#788699', 'letter-spacing="1.5"')}
    ${center(904, 259, 'DATA FLOWS  /  อ่านตามทิศทางหัวลูกศร', 13, '#788699', 'letter-spacing="1"')}
    ${center(1633, 259, 'PROCESS 0', 13, '#788699', 'letter-spacing="1.5"')}
    <rect x="56" y="${top}" width="268" height="${ownerBottom - top}" fill="#f8fafc" stroke="#b7c5d6" stroke-width="1.8"/>
    ${center(190, 324, 'E1', 19, '#526277', 'font-weight="700"')}
    ${person(190, 770, '#526b88')}
    ${center(190, 892, 'ผู้ใช้งาน', 28, '#1f334e', 'font-weight="700"')}
    ${center(190, 934, '/ เจ้าของลิงก์', 25, '#1f334e', 'font-weight="700"')}
    ${center(190, 982, 'สมัครและเข้าสู่ระบบ', 18, '#60738a')}
    ${center(190, 1013, 'จัดการข้อมูลของตนเอง', 18, '#60738a')}
    ${center(190, ownerBottom - 30, 'ฟังก์ชัน 01–10', 16, '#60738a')}
    <rect x="56" y="${publicTop}" width="268" height="124" fill="#f8fafc" stroke="#b7c5d6" stroke-width="1.8"/>
    ${center(190, publicTop + 27, 'E2', 17, '#526277', 'font-weight="700"')}
    ${center(190, publicTop + 58, 'ผู้เปิดลิงก์ / ผู้สแกน QR', 19, '#1f334e', 'font-weight="700"')}
    ${center(190, publicTop + 92, 'ไม่ต้องเข้าสู่ระบบ', 17, '#60738a')}
    <rect x="1488" y="${top}" width="296" height="${processBottom - top + 20}" rx="32" fill="#163c64"/>
    <line x1="1488" y1="363" x2="1784" y2="363" stroke="#779bbb"/>
    ${center(1636, 334, '0', 28, '#ffffff', 'font-weight="700"')}
    ${center(1636, 825, 'Gane & Sarson', 18, '#c5d9ec')}
    ${center(1636, 912, 'ระบบ', 30, '#ffffff', 'font-weight="700"')}
    ${center(1636, 957, 'Short URL', 35, '#ffffff', 'font-weight="700"')}
    ${center(1636, 1009, 'ประมวลผลและส่งผลลัพธ์', 18, '#c5d9ec')}
    ${center(1636, 1041, 'ตามสิทธิ์ของผู้ใช้งาน', 18, '#c5d9ec')}
    <line x1="1530" y1="1428" x2="1742" y2="1428" stroke="#537798"/>
    ${center(1636, 1460, 'Frontend · Gateway', 17, '#c5d9ec')}
    ${center(1636, 1493, 'Auth · Link · Analytics', 17, '#c5d9ec')}
    ${center(1636, 1644, 'ทุกเส้นเชื่อมกับระบบเดียวกัน', 16, '#c5d9ec')}
    ${rows}
    <line x1="56" y1="1745" x2="1784" y2="1745" stroke="#dbe3ed"/>
    ${text(56, 1781, 'วิธีอ่าน', 18, '#1f334e', 'font-weight="700"')}
    ${text(157, 1781, 'เลือกฟังก์ชัน → อ่านเส้นสีน้ำเงินที่ส่งเข้า → อ่านเส้นสีเขียวที่ส่งกลับ', 18, '#526277')}
    ${text(56, 1816, 'ผลลัพธ์ทุกฟังก์ชันอาจเป็นข้อความผิดพลาดได้ เช่น ข้อมูลไม่ถูกต้อง ไม่มีสิทธิ์ หรือบริการไม่พร้อม', 17, '#526277')}
    ${text(56, 1848, 'Process 0 แทนระบบทั้งหมด · กระบวนการหลักและแหล่งเก็บข้อมูลอยู่ใน DFD Level 0 · รายละเอียด: docs/dfd.md', 17, '#526277')}
  </g>
</svg>`;

const mermaid = [
  '%% Context Diagram: one process; individual request and result arrows.',
  '%% scripts/render-dfd-context.mjs renders the same flows with fixed, non-crossing positions.',
  'flowchart LR',
  '  E1["E1 · ผู้ใช้งาน / เจ้าของลิงก์"]',
  '  P0(["0 · ระบบ Short URL"])',
  '  E2["E2 · ผู้เปิดลิงก์ / ผู้สแกน QR"]',
  ...flows.flatMap(([, request, response], i) => {
    const actor = i === 10 ? 'E2' : 'E1';
    return [`  ${actor} -->|"${code(i * 2 + 1)} · ${request}"| P0`, `  P0 -->|"${code(i * 2 + 2)} · ${response}"| ${actor}`];
  }),
  '  classDef entity fill:#f8fafc,stroke:#b7c5d6,color:#1f334e;',
  '  classDef process fill:#163c64,stroke:#163c64,color:#ffffff;',
  '  class E1,E2 entity;',
  '  class P0 process;',
  ...flows.flatMap((_, i) => [`  linkStyle ${i * 2} stroke:#2563b5,color:#2563b5;`, `  linkStyle ${i * 2 + 1} stroke:#087f78,color:#087f78;`]),
].join('\n') + '\n';
await writeFile(resolve(directory, 'dfd-context.mmd'), mermaid);
await writeFile(resolve(directory, 'dfd-context.svg'), svg);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1.5 });
  await page.setContent(`<!doctype html><html lang="th"><meta charset="utf-8"><body style="margin:0">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('body > svg').screenshot({ path: resolve(directory, 'dfd-context.png') });
  console.log('Context Diagram rendered: 11 functions, 22 flows, 1 process.');
} finally {
  await browser.close();
}

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Canonical logical DFD. Repeated symbols are references to the same node.
// SVG uses exact Gane & Sarson shapes; Mermaid is a topology-only companion.
const nodes = {
  E1: { type: 'entity', title: ['ผู้ใช้งาน', '/ เจ้าของลิงก์'] },
  E2: { type: 'entity', title: ['ผู้เปิดลิงก์', '/ ผู้สแกน QR'] },
  P1: { type: 'process', id: '1.0', title: ['จัดการบัญชี', 'และยืนยันตัวตน'] },
  P2: { type: 'process', id: '2.0', title: ['สร้างและจัดการ', 'Short URL'] },
  P3: { type: 'process', id: '3.0', title: ['สร้าง', 'QR Code'] },
  P4: { type: 'process', id: '4.0', title: ['ตรวจลิงก์', 'และส่งต่อ'] },
  P5: { type: 'process', id: '5.0', title: ['บันทึกและสรุป', 'การเปิดลิงก์'] },
  P6: { type: 'process', id: '6.0', title: ['จัดทำประวัติ', 'และรายงานสถิติ'] },
  D1: { type: 'store', title: ['ข้อมูลบัญชี / Session', 'Auth · app_auth', 'users · sessions · rate_limits'] },
  D2: { type: 'store', title: ['ข้อมูลลิงก์', 'Link · app_links', 'links · rate_limits'] },
  D3: { type: 'store', title: ['ข้อมูลการเปิดลิงก์', 'Analytics · app_analytics', 'click_events'] },
};
const edges = [];
const flow = (from, to, label) => {
  const id = `L${String(edges.length + 1).padStart(2, '0')}`;
  edges.push({ id, from, to, label: label.split('|') });
  return id;
};
const a = [
  flow('E1', 'P1', 'ชื่อ อีเมล รหัสผ่าน / session|ชื่อใหม่ หรือ session ที่ขอยกเลิก'),
  flow('P1', 'E1', 'ข้อมูลบัญชี / ผลยืนยันตัวตน|cookie / ผลแก้ชื่อ / ผลออกจากระบบ'),
  flow('P1', 'D1', 'อีเมล / userId / แฮช session|และ key สำหรับตรวจโควตา'),
  flow('P1', 'D1', 'บัญชี / แฮชรหัสผ่าน / ชื่อใหม่|แฮช session / การยกเลิก / โควตา'),
  flow('D1', 'P1', 'บัญชี / แฮชรหัสผ่าน / session|วันหมดอายุ และข้อมูลโควตา'),
];
const b = [
  flow('E1', 'P2', 'session, URL, ชื่อย่อ, วันหมดอายุ|หรือรหัสลิงก์และการตั้งค่าใหม่'),
  flow('P2', 'E1', 'Short URL และข้อมูลลิงก์|สถานะ / วันหมดอายุที่บันทึกแล้ว'),
  flow('P2', 'D2', 'รหัสลิงก์ / userId เจ้าของ|ชื่อย่อ และ key สำหรับตรวจโควตา'),
  flow('P2', 'D2', 'ลิงก์ใหม่ / สถานะเปิด–ปิด|วันหมดอายุ และข้อมูลโควตา'),
  flow('D2', 'P2', 'ลิงก์ / เจ้าของ / ชื่อย่อที่มีแล้ว|สถานะ วันหมดอายุ และโควตา'),
  flow('P2', 'P1', 'session สำหรับยืนยันตัวตน'),
  flow('P1', 'P2', 'userId ที่ยืนยันแล้ว|หรือผลยืนยันตัวตนไม่สำเร็จ'),
];
const c = [
  flow('E1', 'P3', 'session และรหัสลิงก์|รูปแบบภาพ PNG หรือ SVG'),
  flow('P3', 'E1', 'ภาพ QR Code ของ Short URL'),
  flow('P3', 'D2', 'รหัสลิงก์ และ userId เจ้าของ'),
  flow('D2', 'P3', 'ข้อมูลลิงก์และเจ้าของ|สำหรับสร้าง Short URL ใน QR'),
  flow('P3', 'P1', 'session สำหรับยืนยันตัวตน'),
  flow('P1', 'P3', 'userId ที่ยืนยันแล้ว|หรือผลยืนยันตัวตนไม่สำเร็จ'),
];
const d = [
  flow('E2', 'P4', 'รหัสลิงก์, GET/HEAD|ข้อมูลเบราว์เซอร์ และแหล่งที่มา'),
  flow('P4', 'E2', 'URL ปลายทางพร้อม HTTP 302|หรือผลไม่พบ / ปิด / หมดอายุ'),
  flow('P4', 'D2', 'รหัสใน Short URL'),
  flow('D2', 'P4', 'URL ต้นฉบับ / linkId / ownerId|สถานะ และวันหมดอายุ'),
  flow('P4', 'P5', 'eventId, linkId, ownerId, เวลา|ชนิดอุปกรณ์ และแหล่งที่มา'),
  flow('P5', 'P4', 'ผลยืนยันบันทึกเหตุการณ์|หรือข้อผิดพลาดในการบันทึก'),
];
const e = [d[4], d[5],
  flow('P5', 'D3', 'เหตุการณ์เปิดลิงก์|พร้อม eventId ที่ใช้ป้องกันซ้ำ'),
  flow('P5', 'D3', 'ownerId / linkId / ช่วงวันที่|และเงื่อนไขสรุปสถิติ'),
  flow('D3', 'P5', 'ผลบันทึก / เหตุการณ์ที่มีแล้ว|ยอดคลิก รายวัน อุปกรณ์ แหล่งที่มา'),
];
const f = [
  flow('E1', 'P6', 'session, คำค้น, สถานะ, เลขหน้า|ช่วงวันที่ และรหัสลิงก์ (ถ้าระบุ)'),
  flow('P6', 'E1', 'ประวัติ / จำนวนลิงก์ / ยอดคลิก|รายวัน / อุปกรณ์ / แหล่งที่มา'),
  flow('P6', 'P1', 'session สำหรับยืนยันตัวตน'),
  flow('P1', 'P6', 'userId ที่ยืนยันแล้ว|หรือผลยืนยันตัวตนไม่สำเร็จ'),
  flow('P6', 'P2', 'userId, คำค้น, สถานะ, เลขหน้า|หรือรหัสลิงก์ที่ต้องตรวจเจ้าของ'),
  flow('P2', 'P6', 'ลิงก์ของเจ้าของ / ข้อมูลแบ่งหน้า|จำนวนลิงก์รวม และลิงก์ที่ใช้งาน'),
  flow('P6', 'P5', 'ownerId / linkId / ช่วงวันที่|หรือรายการ linkId สำหรับนับคลิก'),
  flow('P5', 'P6', 'ยอดคลิกสะสม / รายวัน|สรุปอุปกรณ์ และแหล่งที่มา'),
];
const sheets = [
  { key: 'account', name: 'บัญชีและการยืนยันตัวตน', process: 'P1', actor: 'E1', flows: a, targets: ['D1'], note: 'สมัคร · เข้าสู่ระบบ · ดูบัญชี · แก้ชื่อ · ออกจากระบบ' },
  { key: 'links', name: 'สร้างและจัดการลิงก์', process: 'P2', actor: 'E1', flows: b, targets: ['D2', 'P1'], note: 'ตรวจเจ้าของ · ชื่อย่อ · วันหมดอายุ · เปิด–ปิดลิงก์' },
  { key: 'qr', name: 'สร้าง QR Code', process: 'P3', actor: 'E1', flows: c, targets: ['D2', 'P1'], note: 'QR เข้ารหัส Short URL · สร้างตามคำขอ · ไม่เก็บภาพในฐานข้อมูล' },
  { key: 'redirect', name: 'เปิดลิงก์และส่งต่อ', process: 'P4', actor: 'E2', flows: d, targets: ['D2', 'P5'], note: 'GET ยืนยันบันทึกคลิกก่อน 302 · HEAD ส่งต่อโดยไม่บันทึกคลิก' },
  { key: 'analytics', name: 'บันทึกและสรุปการเปิด', process: 'P5', actor: 'P4', flows: e, targets: ['D3'], note: 'eventId ป้องกันเหตุการณ์เดิมซ้ำ · รับคำขอสถิติจาก 6.0 ในแผ่น F' },
  { key: 'reports', name: 'ประวัติและรายงานสถิติ', process: 'P6', actor: 'E1', flows: f, targets: ['P1', 'P2', 'P5'], note: 'เฉพาะข้อมูลเจ้าของ · ค้นหา · แบ่งหน้า · สถิติตามช่วงวันที่' },
];
const directory = resolve('docs/diagrams');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, value, size = 20, fill = '#243a54', extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const centered = (x, y, value, size, fill, extra = '') => text(x, y, value, size, fill, `text-anchor="middle" ${extra}`);
const lines = (x, y, values, size = 20, fill = '#243a54', centeredText = false, gap = 29) => values.map((line, i) => (centeredText ? centered : text)(x, y + i * gap, line, size, fill)).join('');
const marker = (id, color) => `<marker id="${id}" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${color}"/></marker>`;

function symbol(key, x, y, w, h, repeated = false) {
  const n = nodes[key];
  if (n.type === 'process') {
    const cy = y + h / 2 + 15;
    return `<g data-node="${key}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="${repeated ? '#f8faff' : '#edf4ff'}" stroke="#3f6b9b" stroke-width="2"/>
      <path d="M${x} ${y + 47} H${x + w}" stroke="#3f6b9b" stroke-width="1.8"/>
      ${centered(x + w / 2, y + 32, n.id, 23, '#244c76', 'font-weight="700"')}
      ${lines(x + w / 2, cy - 13, n.title, repeated ? 19 : 25, '#193e66', true, repeated ? 27 : 37)}
      ${repeated ? centered(x + w / 2, y + h - 11, 'สำเนาอ้างอิง', 13, '#71839a') : ''}
    </g>`;
  }
  if (n.type === 'store') {
    // Open right edge, closed left edge and a separate ID compartment.
    return `<g data-node="${key}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff8e9"/>
      <path d="M${x + w} ${y} H${x} V${y + h} H${x + w} M${x + 43} ${y} V${y + h}" fill="none" stroke="#ac7c2c" stroke-width="2"/>
      ${centered(x + 21, y + h / 2 + 6, key, 17, '#825b1b', 'font-weight="700"')}
      ${lines(x + 58, y + h / 2 - 22, n.title.slice(0, 2), 18, '#71511f', false, 29)}
      ${text(x + 58, y + h / 2 + 34, n.title[2], 13, '#8a6f42')}
      ${repeated ? text(x + 58, y + h - 10, 'สำเนาแหล่งข้อมูลเดิม', 12, '#8a6f42') : ''}
    </g>`;
  }
  return `<g data-node="${key}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8fafc" stroke="#8799ae" stroke-width="1.8"/>
    ${centered(x + w / 2, y + 24, key, 16, '#5b7088', 'font-weight="700"')}
    ${lines(x + w / 2, y + 61, n.title, 20, '#253b55', true, 30)}
    ${repeated ? centered(x + w / 2, y + h - 10, 'สำเนาผู้เกี่ยวข้องเดิม', 12, '#71839a') : ''}
  </g>`;
}

function arrow(edgeId, x1, x2, y) {
  const edge = edges.find(item => item.id === edgeId);
  const reverse = x1 > x2;
  const color = reverse ? '#087f78' : '#2563b5';
  const min = Math.min(x1, x2);
  const labelY = y - (edge.label.length === 1 ? 18 : 43);
  return `<g data-flow="${edge.id}" data-from="${edge.from}" data-to="${edge.to}">
    ${text(min + 18, labelY, edge.id, 13, color, 'font-weight="700"')}
    ${lines(min + 66, labelY, edge.label, 18, color, false, 25)}
    <path d="M${x1} ${y} H${x2}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#${reverse ? 'return' : 'send'})"/>
  </g>`;
}

function panel(sheet, i) {
  const mainX = 620, mainW = 220, targetX = 1240, targetW = 260;
  let body = `<rect x="0" y="0" width="1536" height="644" rx="12" fill="${i % 2 === 0 ? '#ffffff' : '#fbfcfe'}" stroke="#d8e2ee"/>
    ${text(30, 40, `${String.fromCharCode(65 + i)}  ${sheet.name}`, 26, '#183451', 'font-weight="700"')}
    ${text(30, 74, sheet.note, 17, '#657991')}
    <line x1="30" y1="92" x2="1505" y2="92" stroke="#e2e8f0"/>`;
  const reports = sheet.key === 'reports';
  body += symbol(sheet.process, mainX, reports ? 109 : 120, mainW, reports ? 484 : 450);
  body += symbol(sheet.actor, 30, 283, 208, 140, sheet.actor === 'P4' || (sheet.actor === 'E1' && i > 0));
  body += arrow(sheet.flows[0], 238, mainX, 335);
  body += arrow(sheet.flows[1], mainX, 238, 395);
  if (sheet.targets.length === 1) {
    body += symbol(sheet.targets[0], targetX, 205, targetW, 290);
    body += arrow(sheet.flows[2], mainX + mainW, targetX, 275);
    body += arrow(sheet.flows[3], mainX + mainW, targetX, 355);
    body += arrow(sheet.flows[4], targetX, mainX + mainW, 435);
  } else if (reports) {
    sheet.targets.forEach((target, j) => {
      const y = 109 + j * 175;
      body += symbol(target, targetX, y, targetW, 134, true);
      body += arrow(sheet.flows[2 + j * 2], mainX + mainW, targetX, y + 52);
      body += arrow(sheet.flows[3 + j * 2], targetX, mainX + mainW, y + 115);
    });
  } else {
    const three = sheet.key === 'links';
    body += symbol(sheet.targets[0], targetX, 120, targetW, three ? 205 : 175, sheet.key !== 'links');
    body += symbol(sheet.targets[1], targetX, 415, targetW, 145, true);
    body += arrow(sheet.flows[2], mainX + mainW, targetX, 178);
    body += arrow(sheet.flows[3], three ? mainX + mainW : targetX, three ? targetX : mainX + mainW, three ? 245 : 265);
    let next = 4;
    if (three) { body += arrow(sheet.flows[4], targetX, mainX + mainW, 312); next = 5; }
    body += arrow(sheet.flows[next], mainX + mainW, targetX, 466);
    body += arrow(sheet.flows[next + 1], targetX, mainX + mainW, 535);
  }
  return body;
}

function wrap(body, w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title>
    <defs>${marker('send', '#2563b5')}${marker('return', '#087f78')}</defs><rect width="100%" height="100%" fill="#fff"/><g font-family="Tahoma, sans-serif">${body}</g></svg>`.replace(/[\t ]+$/gm, '') + '\n';
}

const width = 3160, height = 2450;
let body = `<rect x="40" y="42" width="6" height="97" fill="#d42d25"/>
  ${text(65, 64, 'DATA FLOW DIAGRAM  /  GANE & SARSON', 16, '#6b7d92', 'letter-spacing="2"')}
  ${text(65, 110, 'DFD Level 0 — ระบบ Short URL', 38, '#152e49', 'font-weight="700"')}
  ${text(65, 146, '6 กระบวนการหลัก · 3 แหล่งเก็บข้อมูล · ลูกศรแต่ละเส้นระบุข้อมูลที่ส่งจริง', 22, '#5c718b')}
  ${text(2110, 108, 'ระดับนี้ขยายจาก Context Diagram', 24, '#244c76', 'font-weight="700"')}
  ${text(2110, 144, 'หมายเลขที่ซ้ำ = กระบวนการหรือแหล่งข้อมูลเดิม', 20, '#5c718b')}
  <rect x="40" y="176" width="3080" height="105" rx="10" fill="#f5f8fc"/>
  <rect x="65" y="197" width="86" height="63" rx="9" fill="#edf4ff" stroke="#3f6b9b" stroke-width="1.5"/><path d="M65 217 H151" stroke="#3f6b9b"/>
  ${centered(108, 212, '1.0', 13, '#244c76')}${text(171, 233, 'Process · กระบวนการ', 20)}
  <path d="M757 202 H635 V255 H757 M666 202 V255" stroke="#ac7c2c" fill="#fff8e9" stroke-width="1.8"/>
  ${centered(650, 234, 'D1', 13, '#825b1b')}${text(778, 233, 'Data Store · แหล่งเก็บข้อมูล', 20)}
  <rect x="1398" y="202" width="90" height="53" fill="#f8fafc" stroke="#8799ae" stroke-width="1.6"/>
  ${text(1507, 233, 'External Agent · ผู้เกี่ยวข้องภายนอก', 20)}
  <path d="M2240 218 H2330" stroke="#2563b5" stroke-width="2" marker-end="url(#send)"/>
  <path d="M2330 245 H2240" stroke="#087f78" stroke-width="2" marker-end="url(#return)"/>
  ${text(2352, 233, 'Data Flow · ลูกศรทางเดียวแยกไป–กลับ', 20)}
`;
for (const [i, sheet] of sheets.entries()) {
  body += `<g transform="translate(${40 + (i % 2) * 1560},${315 + Math.floor(i / 2) * 665})">${panel(sheet, i)}</g>`;
}
body += `<line x1="40" y1="2335" x2="3120" y2="2335" stroke="#d8e2ee"/>
  ${text(40, 2373, 'D1 / D2 / D3 เป็นแหล่งข้อมูลใน PostgreSQL เดียว แยก app_auth / app_links / app_analytics · ไม่ใช่ฐานข้อมูลสามเครื่อง', 20, '#526b86')}
  ${text(40, 2410, 'กรอบ A–F ช่วยจัดหน้าและขยายอ่าน ทุกกรอบอยู่ใน Level 0 เดียวกัน · สีช่วยแยกทิศทาง · ผลลัพธ์อาจเป็นข้อผิดพลาด · รายละเอียด: docs/dfd.md', 19, '#526b86')}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function save(name, svg, w, h) {
    await writeFile(resolve(directory, `${name}.svg`), svg);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html lang="th"><meta charset="utf-8"><body style="margin:0">${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const clipped = await page.locator('text').evaluateAll((items, bounds) => items.filter(item => { const b = item.getBBox(), matrix = item.getCTM(); const p = new DOMPoint(b.x, b.y).matrixTransform(matrix); const end = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(matrix); return p.x < 0 || p.y < 0 || end.x > bounds.w || end.y > bounds.h; }).map(item => item.textContent), { w, h });
    if (clipped.length) throw new Error(`Clipped text in ${name}: ${clipped.join(', ')}`);
    await page.locator('body > svg').screenshot({ path: resolve(directory, `${name}.png`) });
  }
  await save('dfd-level-0', wrap(body, width, height, 'DFD Level 0 — Short URL — Gane & Sarson'), width, height);
  for (const [i, sheet] of sheets.entries()) {
    const title = `DFD Level 0 · แผ่น ${String.fromCharCode(65 + i)} — ${sheet.name}`;
    const detail = `${text(40, 53, title, 28, '#152e49', 'font-weight="700"')}${text(40, 90, 'Gane & Sarson · ภาพส่วนหนึ่งของ Level 0 เดิม · สำเนาอ้างอิงใช้หมายเลขเดิม', 19, '#5c718b')}<g transform="translate(40,120)">${panel(sheet, i)}</g>${text(40, 804, 'คำอธิบายทุกเส้น: docs/dfd.md · สีฟ้าไปทางขวา / สีเขียวไปทางซ้าย · อ่านตามหัวลูกศร', 18, '#5c718b')}`;
    await save(`dfd-detail-${sheet.key}`, wrap(detail, 1616, 840, title), 1616, 840);
  }
} finally { await browser.close(); }

const mmd = ['%% Logical topology companion. Use SVG/PNG for exact Gane & Sarson notation.', 'flowchart LR',
  ...Object.entries(nodes).map(([key, n]) => `  ${key}${n.type === 'store' ? '[(' : n.type === 'process' ? '([' : '['}"${n.id ?? key} · ${n.title.join('<br/>')}"${n.type === 'store' ? ')]' : n.type === 'process' ? '])' : ']'}`),
  ...edges.map(edge => `  ${edge.from} -->|"${edge.id} · ${edge.label.join('<br/>')}"| ${edge.to}`),
].join('\n') + '\n';
await writeFile(resolve(directory, 'dfd-level-0.mmd'), mmd);
await writeFile(resolve(directory, 'dfd-level-0.json'), JSON.stringify({ notation: 'Gane & Sarson', levelConvention: 'Context → Level 0 major processes → Level 1 subprocesses', nodes, edges, sheets }, null, 2) + '\n');
const table = '| เส้น | จาก → ไป | ข้อมูลที่ไหล |\n|---|---|---|\n' + edges.map(edge => `| ${edge.id} | ${nodes[edge.from].id ?? edge.from} → ${nodes[edge.to].id ?? edge.to} | ${edge.label.join(' ')} |`).join('\n');
const docPath = resolve('docs/dfd.md');
let doc = await readFile(docPath, 'utf8');
if (doc.includes('<!-- LEVEL0-FLOWS -->')) {
  doc = doc.replace(/<!-- LEVEL0-FLOWS -->[\s\S]*?<!-- \/LEVEL0-FLOWS -->/, `<!-- LEVEL0-FLOWS -->\n${table}\n<!-- /LEVEL0-FLOWS -->`);
  await writeFile(docPath, doc);
}
console.log(`Rendered Gane & Sarson: 6 processes, 3 data stores, ${edges.length} unique data flows, 6 detail images.`);

// ใช้รายการเดียวกันใน Frontend, Gateway และ Link Service เพื่อไม่ให้ชื่อชนกัน
export const reservedNames = [
  "login", "register", "dashboard", "history", "profile", "analytics", "links",
  "api", "assets", "static", "s", "internal", "healthz", "readyz",
  "favicon", "robots", "sitemap", "index", "_vercel", "_next",
];
export const codePattern = /^[A-Za-z0-9_-]{3,32}$/;

export function isReservedName(name) {
  return reservedNames.includes(name.toLowerCase());
}

export function isShortLinkPath(path) {
  const match = /^\/([A-Za-z0-9_-]{3,32})\/?$/.exec(path.split("?")[0]);
  return Boolean(match && !isReservedName(match[1]));
}

export function shortLinkPath(code) {
  // Alias เก่าที่ตรงกับชื่อสงวนยังเปิดผ่าน /s ได้
  return (isReservedName(code) ? "/s/" : "/") + code;
}

// Vercel จับตัวอักษรแบบ case-sensitive จึงกันทั้ง login, Login และ LOGIN
const reservedPattern = reservedNames
  .map((name) => name.replace(/[a-z]/g, (letter) => `[${letter}${letter.toUpperCase()}]`))
  .join("|");
export const rootShortLinkPattern = `(?!(?:${reservedPattern})(?:/|$))[A-Za-z0-9_-]{3,32}`;
export const rootShortLinkSource = `/:code(${rootShortLinkPattern}){/}?`;

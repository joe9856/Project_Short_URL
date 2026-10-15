// ข้อผิดพลาดจาก HTTP: เพิ่ม status ให้ Error ปกติ เช่น 401 เพื่อให้ผู้เรียกตรวจรหัสได้
export class ApiError extends Error {
  constructor(
    public status: number, // TypeScript สร้าง property status และเก็บค่าที่ส่งมาให้
    message: string,
  ) {
    super(message); // ส่งข้อความให้คลาส Error เพื่ออ่านต่อด้วย error.message
  }
}
// ตัวช่วยที่ Components/Pages เรียก: ส่ง Request → ตรวจสถานะ → คืนข้อมูล หรือโยนข้อผิดพลาดให้ catch
// path /api/* → ตอนพัฒนา Vite Proxy ส่งไป Gateway → Service; Response ย้อนกลับให้ await/.then ของผู้เรียก
// T คือชนิดผลลัพธ์ที่ผู้เรียกระบุ เช่น api<LinkList>(...); ไม่ได้ตรวจรูปแบบ JSON ตอนใช้งานจริง
// path คือที่อยู่ API; options คือ method/body/headers/signal; ไม่ส่ง options จะใช้ object ว่าง
export async function api<T>(path: string, options: RequestInit = {},): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { // await รอ Response ในฟังก์ชันนี้; ถ้าไม่ระบุ method จะใช้ GET
      ...options, // กระจายตัวเลือกจากผู้เรียก เช่น POST และ body ที่แปลงเป็น JSON string แล้ว
      credentials: "same-origin", // ส่ง Cookie เมื่อคำขอมี origin เดียวกับหน้าเว็บ เพื่อใช้ Session
      headers: { "Content-Type": "application/json", ...options.headers }, // Header ของผู้เรียกเพิ่ม/ทับค่าเริ่มต้นได้
      signal: options.signal || AbortSignal.timeout(60000), // ใช้ signal ที่ส่งมา หรือยกเลิกเมื่อครบ 60 วินาที
    });
  } catch {
    // fetch ล้มเหลว เช่น ปัญหาเครือข่าย/ถูกยกเลิก; HTTP 401 หรือ 500 จะไปตรวจ response.ok ด้านล่าง
    throw new Error("เชื่อมต่อบริการไม่ได้ กรุณาลองอีกครั้ง");
  }
  if (!response.ok) { // ok เป็น true เฉพาะ HTTP 200–299; นอกช่วงนี้ให้จัดการเป็นข้อผิดพลาด
    // อ่าน JSON ของข้อผิดพลาด; ถ้าอ่านไม่ได้ เช่น ได้ HTML กลับมา ให้ใช้ข้อความสำรอง
    const result = await response
      .json()
      .catch(() => ({ error: { message: "บริการไม่พร้อมใช้งาน" } }));
    let message = result.error?.message || "เกิดข้อผิดพลาด"; // ?. อ่าน message เมื่อมี error; ไม่มีข้อความใช้ค่าสำรอง
    const fields = result.error?.fields as Record<string, string[]> | undefined; // ข้อผิดพลาดรายช่อง: ชื่อช่อง → array ข้อความ
    if (fields) message += ": " + Object.values(fields).flat().join(", "); // รวมข้อความของทุกช่องเป็นข้อความเดียว
    throw new ApiError(response.status, message); // Promise ถูก reject ให้ catch ของผู้เรียกรับ status และข้อความ
  }
  if (response.status === 204) return undefined as T; // สำเร็จแบบไม่มีเนื้อหา จึงไม่อ่าน JSON; as T บอกชนิดแก่ TypeScript
  return response.json(); // อ่าน JSON แล้วส่งข้อมูลกลับให้ await/.then ของผู้เรียก; ถ้าอ่านไม่ได้ Promise จะ reject
}
// ตัวช่วยแสดงวันที่: string → Date → ข้อความภาษาไทยตามเขตเวลากรุงเทพฯ ไม่ได้เรียก API
export function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}
// รับข้อผิดพลาดที่ยังไม่รู้ชนิด; ถ้าเป็น Error (รวม ApiError) ใช้ message ไม่เช่นนั้นใช้ข้อความสำรอง
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
}

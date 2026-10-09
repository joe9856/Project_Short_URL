export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: options.signal || AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error("เชื่อมต่อบริการไม่ได้ กรุณาลองอีกครั้ง");
  }
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({ error: { message: "บริการไม่พร้อมใช้งาน" } }));
    let message = result.error?.message || "เกิดข้อผิดพลาด";
    const fields = result.error?.fields as Record<string, string[]> | undefined;
    if (fields) message += ": " + Object.values(fields).flat().join(", ");
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export function thaiDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
}

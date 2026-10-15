// App/Pages/Components ส่ง error/loading มา → เลือก JSX ข้อความให้ React แสดง; ไม่เรียก API หรือเปลี่ยน State ของผู้เรียก
export function Feedback({
  error,
  loading,
}: {
  error?: string;
  loading?: boolean;
}) {
  if (error) // ตรวจ error ก่อน จึงแสดงข้อผิดพลาดแม้ loading เป็น true ด้วย
    return (
      <p className="feedback error" role="alert">
        {error}
      </p>
    );
  if (loading) // ไม่มี error แต่ยังรอข้อมูล ให้แสดงกำลังโหลด
    return (
      <p className="feedback" role="status">
        กำลังโหลดข้อมูล…
      </p>
    );
  return null; // ไม่มีทั้งสองสถานะ จึงไม่สร้างส่วนแสดงผลนี้
}

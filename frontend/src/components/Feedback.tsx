export function Feedback({
  error,
  loading,
}: {
  error?: string;
  loading?: boolean;
}) {
  if (error)
    return (
      <p className="feedback error" role="alert">
        {error}
      </p>
    );
  if (loading)
    return (
      <p className="feedback" role="status">
        กำลังโหลดข้อมูล…
      </p>
    );
  return null;
}

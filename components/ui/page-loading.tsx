// Hiển thị khi Next.js đang tải dữ liệu cho trang đích (route segment).
// Next.js tự động render component này (qua loading.tsx) ngay khi người dùng
// bấm vào một mục trong menu, trước khi trang mới sẵn sàng — giúp người dùng
// biết chắc hệ thống đang xử lý, không phải bị đứng máy hay mất kết nối.
export default function PageLoading({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-gold"
      />
      <p className="font-mono text-[11.5px] uppercase tracking-wide text-inksoft">{label}</p>
    </div>
  );
}

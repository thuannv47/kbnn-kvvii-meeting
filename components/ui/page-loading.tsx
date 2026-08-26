/**
 * UI hiển thị tạm trong lúc server đang tải dữ liệu cho trang (Next.js tự
 * dùng file loading.tsx làm Suspense fallback ngay khi người dùng bấm điều
 * hướng sang trang này) — để họ biết là đang có kết nối, không phải đứng máy.
 */
export default function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="skeleton h-7 w-40" />
      <div className="skeleton h-4 w-72" />
      <div className="table-wrap p-0 overflow-hidden">
        <div className="skeleton h-9 w-full rounded-none" />
        <div className="divide-y divide-line">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="skeleton h-3.5 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

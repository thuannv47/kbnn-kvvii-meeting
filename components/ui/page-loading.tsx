import LogoSpinner from '@/components/ui/logo-spinner';

/**
 * UI hiển thị tạm trong lúc server đang tải dữ liệu cho trang (Next.js tự
 * dùng file loading.tsx làm Suspense fallback ngay khi người dùng bấm điều
 * hướng sang trang này) — để họ biết là đang có kết nối, không phải đứng máy.
 *
 * Phủ kín màn hình (fixed inset-0) với nền mờ (backdrop-blur) thay vì chỉ
 * chiếm chỗ nội dung — tạo cảm giác "làm mờ nền" trong lúc tải, đồng nhất
 * với hiệu ứng chuyển trang trước đây, nhưng chỉ còn DUY NHẤT 1 nơi hiển thị
 * loading (không còn RouteProgress chạy song song gây hiện 2 lần).
 */
export default function PageLoading() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white/50 backdrop-blur-sm">
      <LogoSpinner size={52} />
    </div>
  );
}

/**
 * Thanh tiêu đề canh giữa, chỉ hiển thị trên mobile — khớp với các màn hình
 * "Sinh hoạt chi bộ" / "Học tập nghị quyết" / "Tài khoản" trong bản mẫu.
 * Trên desktop, mỗi trang tự hiển thị tiêu đề canh trái riêng (xem `hidden md:block`
 * ở phần <h1> của từng trang) vì bố cục desktop đã có sidebar cố định.
 *
 * Dùng margin âm để "phá" khỏi padding mặc định của <main> (px-4 py-5) trong
 * app/(dashboard)/layout.tsx, cho banner tràn sát viền trên mobile.
 */
export default function PageHeader({ title }: { title: string }) {
  return (
    <div className="md:hidden -mx-4 -mt-5 mb-4 px-4 py-4 bg-surface border-b border-line sticky top-0 z-10 text-center">
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
    </div>
  );
}

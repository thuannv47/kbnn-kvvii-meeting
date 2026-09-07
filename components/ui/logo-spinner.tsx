/**
 * Logo KBNN xoay nhẹ, dùng làm biểu tượng "đang tải" thay cho spinner chấm
 * tròn chung chung — hiển thị ở PageLoading (loading.tsx từng trang) và
 * RouteProgress (khi chuyển trang) để đồng bộ nhận diện thương hiệu.
 */
export default function LogoSpinner({
  size = 48,
  label
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src="/logo-kbnn.png"
        alt="Đang tải"
        width={size}
        height={size}
        className="logo-loading-spin drop-shadow-sm"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {label && <p className="text-xs text-inksoft">{label}</p>}
    </div>
  );
}

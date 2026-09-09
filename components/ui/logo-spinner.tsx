/**
 * Logo KBNN lật xoay từ trái qua phải (quanh trục dọc), kèm dòng chữ thương
 * hiệu "eCabinet KBNN KVVII" + trạng thái tải bên dưới. Dùng CHUNG cho cả
 * PageLoading (loading.tsx từng trang) và RouteProgress (khi chuyển trang)
 * để đồng bộ 1 kiểu duy nhất trong toàn app.
 *
 * Logo gốc (logo-kbnn.png) không vuông (738x659) — luôn cắt vào khung TRÒN
 * (rounded-full + overflow-hidden + object-fit: cover) trước khi lật, để
 * vòng tròn luôn đẹp, không méo bất kể tỉ lệ ảnh gốc hay góc lật hiện tại.
 */
export default function LogoSpinner({
  size = 48,
  label = 'đang tải dữ liệu....'
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="logo-loading-flip rounded-full overflow-hidden bg-white border border-line shadow-sm flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src="/logo-kbnn.png"
          alt="Đang tải"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="text-center leading-tight">
        <p className="text-xs font-semibold text-ink">eCabinet KBNN KVVII</p>
        {label && <p className="text-xs text-inksoft">{label}</p>}
      </div>
    </div>
  );
}

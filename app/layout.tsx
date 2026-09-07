import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phòng họp không giấy tờ',
  description: 'Hệ thống quản lý cuộc họp điện tử',
  // Icon trình duyệt (favicon) cho toàn bộ app — đặt file icon_kbnn.ico vào thư mục public/
  icons: {
    icon: '/icon_kbnn.ico',
    apple: '/apple-touch-icon.png'
  },
  // PWA: cho phép "Thêm vào Màn hình chính" trên iPhone/Android, chạy như app
  // riêng (toàn màn hình, có icon) mà không cần đăng ký Apple Developer hay build App Store.
  // Không dùng metadata.manifest (Next.js tự thêm crossorigin="use-credentials" vào thẻ
  // <link>, khiến Safari yêu cầu cookie khi tải manifest.json và có thể tải thất bại) —
  // khai báo trực tiếp thẻ <link> ở <head> bên dưới thay vì để Next.js tự sinh.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Phòng họp'
  }
};

export const viewport: Viewport = {
  themeColor: '#7A1420'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

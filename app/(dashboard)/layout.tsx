import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import SidebarNav from '@/components/dashboard/sidebar-nav';
import BottomNav from '@/components/dashboard/bottom-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const supabase = createServerSupabase();
  const { data: dept } = await supabase
    .from('departments')
    .select('name')
    .eq('id', profile.department_id)
    .maybeSingle();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      {/* Đã bỏ <RouteProgress /> — trước đây vừa bật ngay khi bấm link (RouteProgress)
          vừa bật loading.tsx của Next.js khi trang mới đang tải dữ liệu, 2 lớp
          logo chồng lên nhau trông như chạy 2 lần. Giờ chỉ còn duy nhất loading.tsx
          (cơ chế Suspense có sẵn của Next.js) cho mỗi trang. */}
      {/* Desktop sidebar */}
      <SidebarNav profile={profile} departmentName={dept?.name} />

      <div className="flex flex-col min-h-screen">
        {/* Header cho mobile do từng trang tự dựng (PageHeader / DashboardBanner)
            vì mỗi màn hình cần một kiểu header khác nhau theo bản mẫu. */}
        {/* pb-20 để chừa chỗ cho bottom nav trên mobile */}
        <main className="flex-1 px-4 py-5 md:px-8 md:py-8 pb-24 md:pb-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

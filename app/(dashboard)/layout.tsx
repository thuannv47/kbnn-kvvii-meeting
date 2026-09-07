import { requireUser } from '@/lib/auth/current-user';
import { createServerSupabase } from '@/lib/supabase/server';
import SidebarNav from '@/components/dashboard/sidebar-nav';
import BottomNav from '@/components/dashboard/bottom-nav';
import RouteProgress from '@/components/dashboard/route-progress';

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
      <RouteProgress />
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

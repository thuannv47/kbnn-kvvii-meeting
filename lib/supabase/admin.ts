import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// CẢNH BÁO: file này chỉ được import trong code chạy trên server
// (Server Actions / Route Handlers). Không import trong bất kỳ Client Component nào.
// `server-only` sẽ khiến build lỗi nếu lỡ bị import vào bundle client.
export function createAdminSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

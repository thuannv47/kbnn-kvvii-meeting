import { createServerSupabase } from '@/lib/supabase/server';

export async function logAudit(params: {
  userId: string;
  action: string; // VD: 'CREATE_MEETING' | 'UPLOAD_DOCUMENT' | 'VIEW_DOCUMENT' | ...
  entityType: string; // VD: 'meeting' | 'document' | 'comment' | 'conclusion'
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabase();
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {}
  });
}

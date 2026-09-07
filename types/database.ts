// File này nên được sinh tự động bằng:
//   npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.ts
// Tạm thời khai báo dạng "any" để không chặn build; thay bằng bản sinh thật trước khi lên production.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

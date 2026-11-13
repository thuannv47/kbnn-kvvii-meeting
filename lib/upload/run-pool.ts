/** Chạy `worker` cho từng phần tử với tối đa `limit` tác vụ song song. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/** PUT file thẳng lên B2 bằng URL đã ký (không đi qua Vercel Function). */
export async function putFileToStorage(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  if (!res.ok) throw new Error('Tải file lên kho lưu trữ thất bại (' + res.status + ').');
}

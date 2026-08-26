'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMeetingAction } from '@/actions/meeting.actions';
import { requestDocumentUploadUrlAction, confirmDocumentUploadAction } from '@/actions/document.actions';
import type { Department } from '@/types/user';
import type { MeetingType } from '@/types/meeting';

const VISIBILITY_OPTIONS = [
  { label: '48 giờ', value: 48 },
  { label: '72 giờ', value: 72 },
  { label: '7 ngày', value: 24 * 7 },
  { label: '30 ngày', value: 24 * 30 },
  { label: 'Không giới hạn', value: '' }
];

type PickableUser = {
  id: string;
  full_name: string;
  position: string | null;
  department_id: string | null;
  departments?: { name: string } | null;
};

/** PUT file thẳng lên B2 bằng URL đã ký (không đi qua Vercel Function). */
async function putFileToStorage(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  if (!res.ok) throw new Error('Tải file đính kèm lên kho lưu trữ thất bại.');
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu (VD gõ "thang" vẫn ra "Thắng"). */
function normalizeVN(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export default function CreateMeetingForm({
  departments,
  users,
  defaultDepartmentId,
  canPickAnyDepartment
}: {
  departments: Department[];
  users: PickableUser[];
  defaultDepartmentId: string;
  canPickAnyDepartment: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>(departments.map((d) => d.id));
  const [meetingType, setMeetingType] = useState<MeetingType>('INTERNAL');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [invitationFile, setInvitationFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  // Phòng chủ trì chỉ có ý nghĩa cho họp Nội bộ (do phòng trong hệ thống tổ chức).
  // Họp Ngoài ngành do đơn vị gửi giấy mời chủ trì — hệ thống vẫn cần 1
  // host_department_id nội bộ để phục vụ phân quyền (ai quản lý/sửa được cuộc
  // họp), nên ngầm gán = phòng của người tạo, KHÔNG hỏi lại người dùng.
  const impliedHostDepartmentId = defaultDepartmentId || departments[0]?.id || '';

  const filteredUsers = participantSearch.trim()
    ? users.filter((u) => {
        const q = normalizeVN(participantSearch.trim());
        return (
          normalizeVN(u.full_name).includes(q) ||
          normalizeVN(u.position || '').includes(q) ||
          normalizeVN(u.departments?.name || '').includes(q)
        );
      })
    : users;

  const selectedUserObjs = users.filter((u) => selectedParticipants.includes(u.id));

  function toggleDept(id: string) {
    setSelectedDepts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const allSelected = departments.length > 0 && selectedDepts.length === departments.length;

  function toggleAll() {
    setSelectedDepts(allSelected ? [] : departments.map((d) => d.id));
  }

  function toggleParticipant(id: string) {
    setSelectedParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Luôn tạo ở dạng NHÁP — người khác chưa thấy được (trừ người được cử đi/tag,
  // họ vẫn thấy ngay để biết mình được cử — xem lib/permissions). Sau khi tạo,
  // vào chi tiết cuộc họp và bấm "Duyệt tạo cuộc họp" khi đã sẵn sàng cho các
  // phòng được phân quyền xem.
  function submit(formData: FormData) {
    setError(null);
    const visRaw = String(formData.get('visibility_duration_hours') || '');

    if (meetingType === 'EXTERNAL' && !String(formData.get('location') || '').trim()) {
      setError('Vui lòng nhập địa điểm cho cuộc họp ngoài ngành.');
      return;
    }
    if (meetingType === 'EXTERNAL' && selectedParticipants.length === 0) {
      setError('Vui lòng chọn ít nhất 1 người được cử đi tham dự.');
      return;
    }

    startTransition(async () => {
      const res = await createMeetingAction({
        title: String(formData.get('title') || ''),
        summary: String(formData.get('summary') || ''),
        location: meetingType === 'EXTERNAL' ? String(formData.get('location') || '') : '',
        meeting_type: meetingType,
        host_department_id:
          meetingType === 'EXTERNAL'
            ? impliedHostDepartmentId
            : String(formData.get('host_department_id') || ''),
        start_at: String(formData.get('start_at') || ''),
        end_at: String(formData.get('end_at') || ''),
        visibility_duration_hours: visRaw === '' ? null : Number(visRaw),
        participant_department_ids: selectedDepts,
        participant_user_ids: meetingType === 'EXTERNAL' ? selectedParticipants : [],
        status: 'DRAFT'
      });

      if (res?.error) {
        setError(res.error);
        return;
      }
      if (!res?.data) return;

      const meeting = res.data;

      // Nếu có đính kèm giấy mời/quyết định cử đi lúc tạo: tải lên ngay, dùng lại
      // đúng luồng upload tài liệu 2 bước (xin URL ký -> PUT thẳng lên B2 -> ghi DB)
      // để file xuất hiện luôn trong tab "Tài liệu" của cuộc họp.
      if (meetingType === 'EXTERNAL' && invitationFile) {
        try {
          const urlRes = await requestDocumentUploadUrlAction({
            meetingId: meeting.id,
            fileName: invitationFile.name,
            fileSize: invitationFile.size,
            mimeType: invitationFile.type || 'application/octet-stream'
          });
          if (urlRes?.error || !urlRes?.data) {
            setError(
              `Đã tạo cuộc họp nhưng đính kèm giấy mời thất bại: ${urlRes?.error ?? 'không xin được URL tải lên'}. ` +
                'Bạn có thể tải lại file ở tab "Tài liệu" trong trang chi tiết.'
            );
            router.push(`/meetings/${meeting.id}`);
            return;
          }
          await putFileToStorage(urlRes.data.uploadUrl, invitationFile);
          await confirmDocumentUploadAction({
            meetingId: meeting.id,
            title: 'Giấy mời / Quyết định cử đi',
            description: 'Đính kèm khi tạo cuộc họp ngoài ngành.',
            storagePath: urlRes.data.storagePath,
            fileName: invitationFile.name,
            mimeType: invitationFile.type || 'application/octet-stream',
            fileSize: invitationFile.size
          });
        } catch (e: any) {
          setError(
            `Đã tạo cuộc họp nhưng đính kèm giấy mời thất bại: ${e?.message ?? ''}. ` +
              'Bạn có thể tải lại file ở tab "Tài liệu" trong trang chi tiết.'
          );
          router.push(`/meetings/${meeting.id}`);
          return;
        }
      }

      router.push(`/meetings/${meeting.id}`);
    });
  }

  return (
    <form className="card p-5 space-y-4" action={submit}>
      <div>
        <label className="text-sm font-medium block mb-1">Tiêu đề *</label>
        <input name="title" required className="input" placeholder="VD: Họp giao ban khu vực tháng 8/2026" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Tóm tắt *</label>
        <textarea name="summary" required rows={3} className="input" />
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">Loại cuộc họp *</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer ${
              meetingType === 'INTERNAL' ? 'border-gold bg-gold/5' : 'border-line'
            }`}
          >
            <input
              type="radio"
              name="meeting_type_radio"
              className="mt-0.5"
              checked={meetingType === 'INTERNAL'}
              onChange={() => setMeetingType('INTERNAL')}
            />
            <span>
              <span className="font-medium block">Nội bộ</span>
              <span className="text-xs text-inksoft">Do phòng ban trong hệ thống tổ chức, như hiện tại.</span>
            </span>
          </label>
          <label
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer ${
              meetingType === 'EXTERNAL' ? 'border-gold bg-gold/5' : 'border-line'
            }`}
          >
            <input
              type="radio"
              name="meeting_type_radio"
              className="mt-0.5"
              checked={meetingType === 'EXTERNAL'}
              onChange={() => setMeetingType('EXTERNAL')}
            />
            <span>
              <span className="font-medium block">Ngoài ngành</span>
              <span className="text-xs text-inksoft">Họp bên ngoài — nhập địa điểm và cử người đi tham dự.</span>
            </span>
          </label>
        </div>
      </div>

      {meetingType === 'EXTERNAL' && (
        <div className="space-y-4 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <div>
            <label className="text-sm font-medium block mb-1">Địa điểm *</label>
            <input
              name="location"
              required
              className="input"
              placeholder="VD: UBND Tỉnh, Phòng họp A tầng 3, hoặc link Zoom/Meet"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Tệp đính kèm (giấy mời, quyết định cử đi…)</label>
            <input
              type="file"
              className="input"
              onChange={(e) => setInvitationFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-inksoft mt-1">
              Không bắt buộc — nếu chưa có file, người được cử đi vẫn tải tài liệu lên cuộc họp sau khi đi họp
              về, ở tab "Tài liệu".
            </p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Người được cử đi tham dự *</label>

            {selectedUserObjs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedUserObjs.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-ink text-white text-xs px-2.5 py-1"
                  >
                    {u.full_name}
                    <button
                      type="button"
                      onClick={() => toggleParticipant(u.id)}
                      className="ml-0.5 opacity-70 hover:opacity-100"
                      aria-label={`Bỏ chọn ${u.full_name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {users.length === 0 ? (
              <p className="text-xs text-inksoft">Không có người dùng nào để chọn.</p>
            ) : (
              <>
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Tìm theo tên, chức danh hoặc phòng ban…"
                  className="input mb-2"
                />
                <div className="max-h-52 overflow-y-auto rounded border border-line bg-surface divide-y divide-line">
                  {filteredUsers.length === 0 && (
                    <p className="text-xs text-inksoft px-3 py-2">Không tìm thấy ai khớp "{participantSearch}".</p>
                  )}
                  {filteredUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(u.id)}
                        onChange={() => toggleParticipant(u.id)}
                      />
                      <span>
                        {u.full_name}
                        <span className="text-inksoft">
                          {' '}
                          — {u.position || 'Chưa có chức danh'}
                          {u.departments?.name ? ` · ${u.departments.name}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <p className="text-xs text-inksoft mt-1">
              Người được chọn sẽ thấy được cuộc họp này ngay (kể cả khi còn ở dạng Nháp) và có thể tải tài
              liệu lên để báo cáo lại.
            </p>
          </div>
        </div>
      )}

      {meetingType === 'INTERNAL' && (
        <div>
          <label className="text-sm font-medium block mb-1">Phòng chủ trì *</label>
          {canPickAnyDepartment ? (
            <select name="host_department_id" required defaultValue={defaultDepartmentId} className="input">
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              {/* Nhân viên/Trưởng phòng chỉ được tạo họp do chính phòng mình chủ trì */}
              <input
                className="input bg-line/40 cursor-not-allowed"
                value={departments.find((d) => d.id === defaultDepartmentId)?.name ?? ''}
                disabled
                readOnly
              />
              <input type="hidden" name="host_department_id" value={defaultDepartmentId} />
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Thời gian bắt đầu *</label>
          <input name="start_at" type="datetime-local" required className="input" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Thời gian kết thúc *</label>
          <input name="end_at" type="datetime-local" required className="input" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Thời gian hiển thị sau kết thúc</label>
        <select name="visibility_duration_hours" defaultValue={48} className="input">
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-inksoft mt-1">
          Sau mốc thời gian này kể từ lúc kết thúc, cuộc họp tự ẩn khỏi Trang chủ và chuyển "Đã đóng"
          (vẫn tìm được ở Tìm kiếm) — không cần đóng/lưu trữ thủ công.
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Phòng được tham gia</label>
          <button type="button" onClick={toggleAll} className="text-xs text-gold underline">
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedDepts.includes(d.id)}
                onChange={() => toggleDept(d.id)}
              />
              {d.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending && <span className="spinner" />}
          {isPending ? 'Đang tạo…' : 'Tạo cuộc họp (Nháp)'}
        </button>
      </div>
      <p className="text-xs text-inksoft">
        Cuộc họp sẽ được tạo ở dạng <span className="font-medium text-ink">Nháp</span> — chỉ mình bạn (và
        người được cử đi, nếu có) thấy được. Vào chi tiết cuộc họp sau khi tạo để bấm "Duyệt tạo cuộc họp"
        khi sẵn sàng cho các phòng ban được phân quyền xem.
      </p>
    </form>
  );
}

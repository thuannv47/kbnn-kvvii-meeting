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

  const [deptSearch, setDeptSearch] = useState('');
  const filteredDepartments = deptSearch.trim()
    ? departments.filter((d) => normalizeVN(d.name).includes(normalizeVN(deptSearch.trim())))
    : departments;

  // Bấm vào TÊN 1 phòng (không phải ô vuông) sẽ lọc danh sách người dự họp
  // bên dưới theo đúng phòng đó — chỉ để dễ tìm, không ảnh hưởng quyền xem.
  const [peopleDeptFilter, setPeopleDeptFilter] = useState<string | null>(null);
  const peopleDeptFilterName = departments.find((d) => d.id === peopleDeptFilter)?.name ?? null;

  const selectedUserObjs = users.filter((u) => selectedParticipants.includes(u.id));

  const filteredUsersForInternal = users.filter((u) => {
    const matchDept = !peopleDeptFilter || u.department_id === peopleDeptFilter;
    const q = participantSearch.trim();
    const matchSearch =
      !q ||
      normalizeVN(u.full_name).includes(normalizeVN(q)) ||
      normalizeVN(u.position || '').includes(normalizeVN(q)) ||
      normalizeVN(u.departments?.name || '').includes(normalizeVN(q));
    return matchDept && matchSearch;
  });

  // ============================================================
  // QUY TẮC PHÂN QUYỀN HỌP NỘI BỘ — 1 NGUỒN DUY NHẤT: selectedParticipants.
  // ============================================================
  // Ai được TICK ở danh sách người thì xem được cuộc họp, ai KHÔNG được tick
  // thì KHÔNG xem được — không còn khái niệm "cả phòng tự động xem được" nữa.
  // Tick vào Ô VUÔNG của 1 phòng chỉ là thao tác NHANH: tự động tick/bỏ tick
  // TOÀN BỘ người trong phòng đó vào danh sách người ở dưới — sau đó vẫn có
  // thể bỏ tick riêng từng người để loại trừ họ.
  function departmentUserIds(deptId: string) {
    return users.filter((u) => u.department_id === deptId).map((u) => u.id);
  }
  function isDeptFullySelected(deptId: string) {
    const ids = departmentUserIds(deptId);
    return ids.length > 0 && ids.every((id) => selectedParticipants.includes(id));
  }
  function isDeptPartiallySelected(deptId: string) {
    const ids = departmentUserIds(deptId);
    return ids.some((id) => selectedParticipants.includes(id)) && !isDeptFullySelected(deptId);
  }
  function toggleDept(deptId: string) {
    const ids = departmentUserIds(deptId);
    const turningOn = !isDeptFullySelected(deptId);
    setSelectedParticipants((prev) => {
      if (turningOn) return Array.from(new Set([...prev, ...ids]));
      return prev.filter((id) => !ids.includes(id));
    });
  }

  const allSelected = users.length > 0 && users.every((u) => selectedParticipants.includes(u.id));

  function toggleAll() {
    setSelectedParticipants(allSelected ? [] : users.map((u) => u.id));
  }

  function toggleParticipant(id: string) {
    setSelectedParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Luôn tạo ở dạng NHÁP — người khác chưa thấy được (trừ người được tick, họ
  // vẫn thấy ngay để biết mình được mời — xem lib/permissions). Sau khi tạo,
  // vào chi tiết cuộc họp và bấm "Duyệt tạo cuộc họp" để chính thức mở.
  function submit(formData: FormData) {
    setError(null);
    const visRaw = String(formData.get('visibility_duration_hours') || '');

    if (meetingType === 'EXTERNAL' && !String(formData.get('location') || '').trim()) {
      setError('Vui lòng nhập địa điểm cho cuộc họp ngoài ngành.');
      return;
    }
    if (selectedParticipants.length === 0) {
      setError(
        meetingType === 'EXTERNAL'
          ? 'Vui lòng chọn ít nhất 1 người được cử đi tham dự.'
          : 'Vui lòng chọn ít nhất 1 người được xem cuộc họp (tick cả phòng hoặc từng người ở dưới).'
      );
      return;
    }

    startTransition(async () => {
      const res = await createMeetingAction({
        title: String(formData.get('title') || ''),
        summary: String(formData.get('summary') || ''),
        location: String(formData.get('location') || ''),
        meeting_type: meetingType,
        host_department_id:
          meetingType === 'EXTERNAL'
            ? impliedHostDepartmentId
            : String(formData.get('host_department_id') || ''),
        start_at: String(formData.get('start_at') || ''),
        end_at: String(formData.get('end_at') || ''),
        visibility_duration_hours: visRaw === '' ? null : Number(visRaw),
        // Không còn cấp quyền theo CẢ PHÒNG nữa — luôn rỗng. Quyền xem hoàn
        // toàn dựa vào participant_user_ids (từng người cụ thể được tick).
        participant_department_ids: [],
        participant_user_ids: selectedParticipants,
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
    <form className="card p-0 overflow-hidden" action={submit}>
      {/* ---- TAB SWITCHER: 2 tab thật sự, không phải 2 thẻ radio nhỏ ---- */}
      <div className="grid grid-cols-2 border-b border-line">
        <button
          type="button"
          onClick={() => setMeetingType('INTERNAL')}
          className={`px-4 py-3.5 text-sm font-semibold text-center transition-colors ${
            meetingType === 'INTERNAL'
              ? 'bg-surface text-ink border-b-2 border-gold -mb-px'
              : 'bg-paper2/60 text-inksoft hover:text-ink'
          }`}
        >
          Họp nội bộ
          <span className="block text-xs font-normal mt-0.5 text-inksoft">
            Do phòng ban trong hệ thống tổ chức
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMeetingType('EXTERNAL')}
          className={`px-4 py-3.5 text-sm font-semibold text-center transition-colors ${
            meetingType === 'EXTERNAL'
              ? 'bg-surface text-ink border-b-2 border-gold -mb-px'
              : 'bg-paper2/60 text-inksoft hover:text-ink'
          }`}
        >
          Họp ngoài ngành
          <span className="block text-xs font-normal mt-0.5 text-inksoft">
            Họp bên ngoài — có địa điểm và người cử đi
          </span>
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Tiêu đề *</label>
          <input name="title" required className="input" placeholder="VD: Họp giao ban khu vực tháng 8/2026" />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Tham dự cuộc họp (Người được cử tham dự cuộc họp)</label>
          <textarea
            name="summary"
            rows={3}
            className="input"
            placeholder="VD: Đ/c Nguyễn Văn A chủ trì cuộc họp"
          />
        </div>

        {meetingType === 'INTERNAL' ? (
          <>
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

            <div>
              <label className="text-sm font-medium block mb-1">Địa điểm (nếu có)</label>
              <input
                name="location"
                className="input"
                placeholder="VD: Phòng họp A, tầng 3 hoặc đường link Zoom/Google Meet"
              />
            </div>

            {/* Xếp dọc (1 cột) trên mobile để ô datetime-local có đủ chỗ hiển thị
                ngày + giờ + icon lịch, tránh bị tràn khung; chỉ xếp ngang từ màn
                hình sm trở lên. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-sm font-medium block mb-1">Thời gian bắt đầu *</label>
                <input
                  name="start_at"
                  type="datetime-local"
                  required
                  className="input w-full min-w-0 text-sm sm:text-base"
                />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium block mb-1">Thời gian kết thúc *</label>
                <input
                  name="end_at"
                  type="datetime-local"
                  required
                  className="input w-full min-w-0 text-sm sm:text-base"
                />
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
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Phòng ban (chọn nhanh theo phòng)</label>
                <button type="button" onClick={toggleAll} className="text-xs text-gold underline">
                  {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
              <p className="text-xs text-inksoft mb-2">
                Tick 1 phòng sẽ tự động tick <b>toàn bộ người trong phòng đó</b> ở danh sách "Người được xem
                cuộc họp" bên dưới — bạn vẫn có thể bỏ tick riêng từng người để loại trừ họ. Bấm vào{' '}
                <b>tên phòng</b> (không phải ô vuông) để lọc nhanh người của phòng đó bên dưới.
              </p>

              <input
                type="text"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="Tìm theo tên phòng ban…"
                className="input mb-2"
              />
              <div className="max-h-52 overflow-y-auto rounded border border-line bg-surface divide-y divide-line">
                {filteredDepartments.length === 0 && (
                  <p className="text-xs text-inksoft px-3 py-2">Không tìm thấy phòng nào khớp "{deptSearch}".</p>
                )}
                {filteredDepartments.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm px-3 py-2 hover:bg-paper2/60">
                    <input
                      type="checkbox"
                      checked={isDeptFullySelected(d.id)}
                      ref={(el) => {
                        if (el) el.indeterminate = isDeptPartiallySelected(d.id);
                      }}
                      onChange={() => toggleDept(d.id)}
                    />
                    <button
                      type="button"
                      onClick={() => setPeopleDeptFilter(peopleDeptFilter === d.id ? null : d.id)}
                      className={`flex-1 text-left ${
                        peopleDeptFilter === d.id ? 'text-gold font-medium' : ''
                      }`}
                      title="Bấm để lọc danh sách người dự họp bên dưới theo phòng này"
                    >
                      {d.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">
                Người được xem cuộc họp <span className="text-red">* bắt buộc</span>
              </label>
              <p className="text-xs text-inksoft mb-2">
                <b>Chỉ những người được tick dưới đây</b> mới xem được cuộc họp — người không được tick sẽ
                không thấy, kể cả sau khi Duyệt. Tick nhanh cả phòng ở mục trên, hoặc tìm/tick từng người ở
                đây.
              </p>

              {peopleDeptFilterName && (
                <div className="flex items-center gap-1.5 mb-2 text-xs">
                  <span className="text-inksoft">Đang lọc theo phòng:</span>
                  <span className="inline-flex items-center gap-1 bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">
                    {peopleDeptFilterName}
                    <button type="button" onClick={() => setPeopleDeptFilter(null)} className="hover:text-red">
                      ×
                    </button>
                  </span>
                </div>
              )}

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

              <input
                type="text"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Tìm theo tên, chức danh hoặc phòng ban…"
                className="input mb-2"
              />
              <div className="max-h-52 overflow-y-auto rounded border border-line bg-surface divide-y divide-line">
                {filteredUsersForInternal.length === 0 && (
                  <p className="text-xs text-inksoft px-3 py-2">
                    {peopleDeptFilterName
                      ? `Phòng "${peopleDeptFilterName}" chưa có ai khớp tìm kiếm.`
                      : `Không tìm thấy ai khớp "${participantSearch}".`}
                  </p>
                )}
                {filteredUsersForInternal.map((u) => (
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
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium block mb-1">Địa điểm *</label>
              <input
                name="location"
                required
                className="input"
                placeholder="VD: UBND Tỉnh, Phòng họp A tầng 3, hoặc link Zoom/Meet"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-sm font-medium block mb-1">Thời gian bắt đầu *</label>
                <input
                  name="start_at"
                  type="datetime-local"
                  required
                  className="input w-full min-w-0 text-sm sm:text-base"
                />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium block mb-1">Thời gian kết thúc *</label>
                <input
                  name="end_at"
                  type="datetime-local"
                  required
                  className="input w-full min-w-0 text-sm sm:text-base"
                />
              </div>
            </div>

            {/* Vẫn giữ mặc định 48h ngầm định (input ẩn) — không hỏi lại người
                dùng ở tab này để đỡ rối, đúng theo yêu cầu chỉ giữ những
                trường thật sự cần cho quy trình họp ngoài ngành. */}
            <input type="hidden" name="visibility_duration_hours" value={48} />

            <div>
              <label className="text-sm font-medium block mb-1">Tệp đính kèm (giấy mời, quyết định cử đi…)</label>
              <input
                type="file"
                className="input"
                onChange={(e) => setInvitationFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Người tham gia dự họp *</label>

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
                      <p className="text-xs text-inksoft px-3 py-2">
                        Không tìm thấy ai khớp "{participantSearch}".
                      </p>
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
            </div>
          </>
        )}

        {error && <p className="text-red text-sm">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending && <span className="spinner" />}
            {isPending ? 'Đang tạo…' : 'Tạo cuộc họp (Nháp)'}
          </button>
        </div>
      </div>
    </form>
  );
}

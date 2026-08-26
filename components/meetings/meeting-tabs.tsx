'use client';

import { useState } from 'react';
import type { Meeting, MeetingDepartment, MeetingConclusion, MeetingParticipant } from '@/types/meeting';
import type { Profile, Department } from '@/types/user';
import TabInfo from '@/components/meetings/tab-info';
import TabDocuments from '@/components/documents/tab-documents';
import TabComments from '@/components/comments/tab-comments';
import TabConclusion from '@/components/conclusions/tab-conclusion';
import MeetingStatusBadge from '@/components/meetings/meeting-status-badge';

type TabKey = 'info' | 'documents' | 'comments' | 'conclusion';

export default function MeetingTabs(props: {
  meeting: Meeting;
  hostDepartmentName?: string;
  perms: MeetingDepartment[];
  participants: (MeetingParticipant & { profiles?: { full_name: string; position: string | null } })[];
  documents: any[];
  comments: any[];
  conclusion: MeetingConclusion | null;
  allDepartments: Department[];
  profile: Profile;
  canManage: boolean;
  canDelete: boolean;
}) {
  const { meeting, hostDepartmentName, documents, comments, canManage, participants } = props;
  const [tab, setTab] = useState<TabKey>('info');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'documents', label: `Tài liệu (${documents.length})` },
    { key: 'comments', label: `Ý kiến (${comments.length})` },
    { key: 'conclusion', label: 'Kết luận' }
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <MeetingStatusBadge meeting={meeting} />
          {meeting.meeting_type === 'EXTERNAL' && (
            <span className="badge bg-gold/15 text-gold">Ngoài ngành</span>
          )}
          <p className="font-mono text-xs text-inksoft">{meeting.code}</p>
        </div>
        <h1 className="text-2xl mb-1">{meeting.title}</h1>
        <p className="text-inksoft text-sm">
          {hostDepartmentName} · {new Date(meeting.start_at).toLocaleString('vi-VN')} →{' '}
          {new Date(meeting.end_at).toLocaleString('vi-VN')}
        </p>
        {meeting.location && (
          <p className="text-inksoft text-sm mt-0.5">
            <span aria-hidden>📍</span> {meeting.location}
          </p>
        )}
        {participants.length > 0 && (
          <p className="text-inksoft text-sm mt-0.5">
            <span aria-hidden>🧑‍💼</span> Cử đi:{' '}
            {participants.map((p) => p.profiles?.full_name).filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key ? 'border-gold text-ink' : 'border-transparent text-inksoft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'info' && (
          <TabInfo
            meeting={meeting}
            perms={props.perms}
            participants={participants}
            allDepartments={props.allDepartments}
            canManage={canManage}
            canDelete={props.canDelete}
          />
        )}
        {tab === 'documents' && (
          <TabDocuments
            meeting={meeting}
            perms={props.perms}
            participants={participants}
            documents={documents}
            profile={props.profile}
          />
        )}
        {tab === 'comments' && (
          <TabComments
            meeting={meeting}
            perms={props.perms}
            participants={participants}
            comments={comments}
            profile={props.profile}
          />
        )}
        {tab === 'conclusion' && (
          <TabConclusion meeting={meeting} conclusion={props.conclusion} profile={props.profile} canManage={canManage} />
        )}
      </div>
    </div>
  );
}

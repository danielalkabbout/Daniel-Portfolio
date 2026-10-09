import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/client';
import { Head } from './views';
import { Ic, useUi } from './ui';

export interface ServiceRequest {
  id: number;
  name: string;
  email: string;
  company: string;
  services: string[];
  timeline: string;
  message: string;
  status: 'New' | 'Read' | 'Replied' | 'Archived';
  createdAt: string;
}

const STATUSES = ['New', 'Read', 'Replied', 'Archived'] as const;

export function useRequests() {
  return useQuery({
    queryKey: ['admin', 'requests'],
    queryFn: () => api<ServiceRequest[]>('/api/admin/requests'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Whether new requests are also emailed to you, with a test button and setup steps when they aren't. */
function EmailStatus() {
  const { toast } = useUi();
  const [sending, setSending] = useState(false);
  const { data } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: () => api<{ email: boolean; to: string }>('/api/admin/notifications'),
    staleTime: 5 * 60_000,
  });
  if (!data) return null;

  const test = async () => {
    setSending(true);
    try {
      await api('/api/admin/notifications/test', { method: 'POST' });
      toast(`Test email sent to ${data.to}`);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSending(false);
    }
  };

  return data.email ? (
    <div className="adm-mail on" role="status">
      <span className="adm-mail-ic">
        <Ic n="mail" />
      </span>
      <div>
        <b>Email alerts are on</b>
        <small>Every new request is saved here and emailed to {data.to}. Reply to the email to answer directly.</small>
      </div>
      <button type="button" className="adm-btn ghost" disabled={sending} onClick={() => void test()}>
        {sending ? 'Sending…' : 'Send test email'}
      </button>
    </div>
  ) : (
    <details className="adm-mail">
      <summary>
        <span className="adm-mail-ic">
          <Ic n="mail" />
        </span>
        <div>
          <b>Email alerts are off</b>
          <small>Requests are saved here. Turn on email to also get each one in your inbox. Click for the steps.</small>
        </div>
      </summary>
      <ol>
        <li>
          Create a free account at <b>resend.com</b> with the email address you want the alerts sent to.
        </li>
        <li>
          In Resend, open <b>API Keys</b> and create a key with <b>Sending access</b>. Copy it.
        </li>
        <li>
          On <b>Render</b>, open your API service, then <b>Environment</b>, and add <code>Email__ResendApiKey</code>{' '}
          (the key) and <code>Email__To</code> (your email). Save; the API restarts by itself.
        </li>
        <li>Come back here and press Send test email.</li>
      </ol>
    </details>
  );
}

/** Requests sent from the site: the Services form and "Request the code" on projects. */
export function RequestsView() {
  const { ask, toast } = useUi();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useRequests();
  const [filter, setFilter] = useState<'All' | (typeof STATUSES)[number]>('All');
  const [openId, setOpenId] = useState<number | null>(null);

  const setStatus = async (r: ServiceRequest, status: string) => {
    try {
      await api(`/api/admin/requests/${r.id}`, { method: 'PATCH', body: { status } });
      qc.setQueryData<ServiceRequest[]>(['admin', 'requests'], (list) =>
        list?.map((x) => (x.id === r.id ? { ...x, status: status as ServiceRequest['status'] } : x)),
      );
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const remove = async (r: ServiceRequest) => {
    if (
      !(await ask({
        title: `Delete the request from ${r.name}?`,
        text: 'This removes it for good.',
        ok: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/admin/requests/${r.id}`, { method: 'DELETE' });
      qc.setQueryData<ServiceRequest[]>(['admin', 'requests'], (list) => list?.filter((x) => x.id !== r.id));
      toast('Request deleted');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const list = (data ?? []).filter((r) => filter === 'All' || r.status === filter);
  const count = (s: string) => (data ?? []).filter((r) => r.status === s).length;

  return (
    <>
      <Head
        title="Requests"
        desc="Everything visitors send you: the Services form and code requests from projects, newest first."
        actions={
          <button type="button" className="adm-btn ghost" onClick={() => void refetch()}>
            Refresh
          </button>
        }
      />
      <EmailStatus />
      <div className="adm-seg" role="tablist" aria-label="Filter requests">
        {(['All', ...STATUSES] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}>
            {s}
            {s !== 'All' && <em>{count(s)}</em>}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="adm-gate">
          <span className="adm-spin" />
          <p>Loading requests…</p>
        </div>
      ) : error ? (
        <p className="adm-warn">Could not load requests: {(error as Error).message}</p>
      ) : !list.length ? (
        <div className="adm-list">
          <div className="adm-empty">
            <Ic n="requests" />
            <b>{filter === 'All' ? 'No requests yet' : `No ${filter.toLowerCase()} requests`}</b>
            <span>New requests from the Services page show up here.</span>
          </div>
        </div>
      ) : (
        <div className="adm-reqs">
          {list.map((r) => {
            const isOpen = openId === r.id;
            const reply = `mailto:${r.email}?subject=${encodeURIComponent(`Re: your request (${r.services.join(', ')})`)}`;
            return (
              <article key={r.id} className={`adm-req${isOpen ? ' open' : ''}${r.status === 'New' ? ' new' : ''}`}>
                <button
                  type="button"
                  className="adm-req-head"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpenId(isOpen ? null : r.id);
                    if (!isOpen && r.status === 'New') void setStatus(r, 'Read');
                  }}
                >
                  <span className="adm-co">{r.name.charAt(0).toUpperCase()}</span>
                  <span className="adm-rtxt">
                    <b>
                      {r.name}
                      {r.company && <small> · {r.company}</small>}
                    </b>
                    <span>{r.services.join(', ')}</span>
                  </span>
                  <span className={`adm-tag${r.status === 'New' ? ' ok' : r.status === 'Archived' ? ' warn' : ''}`}>
                    {r.status}
                  </span>
                  <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString()}</time>
                </button>
                {isOpen && (
                  <div className="adm-req-body">
                    <dl>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${r.email}`}>{r.email}</a>
                      </dd>
                      <dt>Timeline</dt>
                      <dd>{r.timeline || 'Not given'}</dd>
                      <dt>Sent</dt>
                      <dd>{new Date(r.createdAt).toLocaleString()}</dd>
                    </dl>
                    <p className="adm-req-msg">{r.message}</p>
                    <div className="adm-row2">
                      <a className="adm-btn primary" href={reply} onClick={() => void setStatus(r, 'Replied')}>
                        <Ic n="mail" />
                        Reply by email
                      </a>
                      <label className="adm-req-status">
                        Status
                        <select value={r.status} onChange={(e) => void setStatus(r, e.target.value)}>
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="adm-btn ghost danger" onClick={() => void remove(r)}>
                        <Ic n="del" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  at: string;
}

/** Recent changes made from the studio, as recorded by the API. */
export function ActivityView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api<AuditEntry[]>('/api/admin/audit?take=100'),
  });
  const verb: Record<string, string> = {
    update: 'Updated',
    status: 'Changed status of',
    delete: 'Deleted',
    upload: 'Uploaded',
    publish: 'Rebuilt',
    login: 'Signed in to',
  };
  return (
    <>
      <Head title="Activity" desc="The last 100 changes made from the studio." />
      {isLoading ? (
        <div className="adm-gate">
          <span className="adm-spin" />
          <p>Loading activity…</p>
        </div>
      ) : error ? (
        <p className="adm-warn">Could not load activity: {(error as Error).message}</p>
      ) : (
        <div className="adm-card">
          <ol className="adm-audit">
            {(data ?? []).map((a) => (
              <li key={a.id}>
                <time dateTime={a.at}>{new Date(a.at).toLocaleString()}</time>
                <span>
                  <b>
                    {verb[a.action] ?? a.action} {a.entity}
                    {a.entityId ? ` #${a.entityId}` : ''}
                  </b>
                  {a.details && <small>{a.details.length > 140 ? `${a.details.slice(0, 140)}…` : a.details}</small>}
                </span>
              </li>
            ))}
            {!data?.length && <li className="adm-muted">Nothing yet.</li>}
          </ol>
        </div>
      )}
    </>
  );
}

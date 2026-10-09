import { useId, useRef, useState, type FormEvent } from 'react';
import { api, API_ENABLED, ApiError } from '../../api/client';
import { useSite } from '../../api/content';
import { Turnstile, TURNSTILE_SITE_KEY } from '../services/Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/**
 * For a project whose code isn't public: a button that opens a short form, and the request lands in
 * the studio's Requests like any other (service "Code access").
 */
export function CodeRequest({ project }: { project: string }) {
  const site = useSite();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', reason: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<'api' | 'mail' | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: '', form: '' }));
  };

  const message = () =>
    `Code access request for "${project}".` + (form.reason.trim() ? `\n\n${form.reason.trim()}` : '');

  const mailto = () => {
    const body =
      `Name: ${form.name.trim()}\nEmail: ${form.email.trim()}` +
      (form.company.trim() ? `\nCompany: ${form.company.trim()}` : '') +
      `\n\n${message()}`;
    window.location.href = `mailto:${site.profile.email}?subject=${encodeURIComponent(
      `Code access: ${project}`,
    )}&body=${encodeURIComponent(body)}`;
    setSent('mail');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!form.name.trim()) er.name = 'Enter your name.';
    if (!EMAIL_RE.test(form.email.trim())) er.email = 'Enter a valid email address.';
    if (er.name || er.email) {
      setErrors(er);
      (er.name ? nameRef : emailRef).current?.focus();
      return;
    }
    if (!API_ENABLED) return mailto();
    if (TURNSTILE_SITE_KEY && !token) return setErrors({ form: 'Please complete the quick check, then send again.' });
    setSending(true);
    try {
      await api('/api/requests', {
        method: 'POST',
        timeoutMs: 60000,
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          services: ['Code access'],
          timeline: '',
          message: message(),
          turnstileToken: token,
          website: form.website,
        },
      });
      setSent('api');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 429))
        setErrors({ form: err.messages.join(' ') });
      else mailto(); // server unreachable: the email app keeps the request from getting lost
    } finally {
      setSending(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="pj-link pj-req"
        aria-expanded="false"
        onClick={() => {
          setOpen(true);
          setTimeout(() => nameRef.current?.focus(), 0);
        }}
      >
        <LockIcon />
        Request the code
      </button>
    );

  if (sent)
    return (
      <div className="pj-req-box done" role="status">
        <b>{sent === 'api' ? 'Request sent' : 'Almost there'}</b>
        <p>
          {sent === 'api'
            ? `Thanks, ${form.name.trim()}. I'll reply to ${form.email.trim()} about access to the code.`
            : 'Your email app opened with the request filled in. Send it from there.'}
        </p>
      </div>
    );

  return (
    <form className="pj-req-box" onSubmit={(e) => void submit(e)} noValidate aria-labelledby={`${id}-t`}>
      <div className="pj-req-h">
        <b id={`${id}-t`}>
          <LockIcon />
          Request the code
        </b>
        <button type="button" className="pj-req-x" aria-label="Close" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      <p className="pj-req-note">This code isn't public. Tell me who you are and I'll share access.</p>
      <div className="pj-req-row">
        <label>
          <span>Name</span>
          <input
            ref={nameRef}
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
            maxLength={120}
            aria-invalid={!!errors.name || undefined}
          />
          {errors.name && <small className="err">{errors.name}</small>}
        </label>
        <label>
          <span>Email</span>
          <input
            ref={emailRef}
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            maxLength={200}
            aria-invalid={!!errors.email || undefined}
          />
          {errors.email && <small className="err">{errors.email}</small>}
        </label>
      </div>
      <label>
        <span>
          Company <em>optional</em>
        </span>
        <input value={form.company} onChange={set('company')} autoComplete="organization" maxLength={160} />
      </label>
      <label>
        <span>
          Why you'd like to see it <em>optional</em>
        </span>
        <textarea value={form.reason} onChange={set('reason')} rows={3} maxLength={1500} />
      </label>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={set('website')}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      {API_ENABLED && <Turnstile onToken={setToken} />}
      {errors.form && (
        <p className="err" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={sending}>
        {sending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}

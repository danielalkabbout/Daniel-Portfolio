import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { changePassword, logout } from './auth';
import { Head } from './views';
import { useUi } from './ui';

const MIN = 12;

/** Change the studio password. It is stored, hashed, in the database. */
export function AccountView() {
  const { toast } = useUi();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < MIN) return setError(`Use at least ${MIN} characters for the new password.`);
    if (next !== repeat) return setError('The two new passwords don’t match.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      toast('Password changed. Other signed-in devices were signed out.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast('Your session ended. Sign in again.', 'err');
        logout();
      } else setError(err instanceof ApiError ? err.messages.join(' ') : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head title="Account" desc="Your studio sign-in. The password is stored only as a secure hash in the database." />
      <form className="adm-card adm-form adm-account" onSubmit={(e) => void submit(e)}>
        <h3>Change password</h3>
        <div className="adm-field">
          <label htmlFor="pwCur">Current password</label>
          <input
            id="pwCur"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="adm-field">
          <label htmlFor="pwNew">New password</label>
          <input
            id="pwNew"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <small className="adm-help">
            At least {MIN} characters. A short sentence is easy to remember and hard to guess.
          </small>
        </div>
        <div className="adm-field">
          <label htmlFor="pwRep">Repeat the new password</label>
          <input
            id="pwRep"
            type="password"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {error && (
          <p className="adm-login-err" role="alert">
            {error}
          </p>
        )}
        <div className="adm-row2">
          <button type="submit" className="adm-btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
        <p className="adm-muted">
          After 5 wrong passwords, sign-in locks for 15 minutes. Forgot it? Run{' '}
          <code>dotnet run --project src/Portfolio.Api -- create-admin</code> on your laptop to set a new one.
        </p>
      </form>
    </>
  );
}

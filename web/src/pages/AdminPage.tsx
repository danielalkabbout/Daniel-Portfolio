import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { api, API_ENABLED, ApiError } from '../api/client';
import { siteContentSchema, type SiteContent } from '../types/content';
import { fallbackContent } from '../api/content';
import { checkSession, login, logout, useAdminSession } from '../features/admin/auth';
import { Studio } from '../features/admin/Studio';
import { Ic, UiProvider } from '../features/admin/ui';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Wrong email or password.'
          : err instanceof ApiError && err.status === 503
            ? 'No studio account yet. Create one with: dotnet run --project src/Portfolio.Api -- create-admin'
            : (err as Error).message,
      );
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-gate">
      <form className="adm-login" onSubmit={(e) => void submit(e)}>
        <span className="adm-logo">
          <Ic n="lock" />
        </span>
        <h1 tabIndex={-1}>Content studio</h1>
        <p>Sign in to edit your portfolio.</p>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="adm-login-err" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="adm-btn primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <Link to="/" className="adm-link">
          Back to the site
        </Link>
      </form>
    </div>
  );
}

function Loaded() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'content'],
    queryFn: async (): Promise<SiteContent> => {
      const raw = await api<unknown>('/api/admin/content', { timeoutMs: 90000 });
      const parsed = siteContentSchema.safeParse(raw);
      // An empty database returns a blank document; start from the bundled content instead.
      return parsed.success && parsed.data.projects.length + parsed.data.experience.length > 0
        ? parsed.data
        : fallbackContent;
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: 1,
  });
  if (isLoading)
    return (
      <div className="adm-gate">
        <span className="adm-spin" />
        <p>Loading your content… The server may take a minute to wake up.</p>
      </div>
    );
  if (error || !data)
    return (
      <div className="adm-gate">
        <Ic n="lock" />
        <h2>Could not load your content</h2>
        <p>{(error as Error)?.message}</p>
        <div className="adm-row2">
          <button type="button" className="adm-btn primary" onClick={() => void refetch()}>
            Try again
          </button>
          <button type="button" className="adm-btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  return <Studio initial={data} />;
}

export default function AdminPage() {
  const session = useAdminSession();
  // The session cookie is HttpOnly, so ask the API whether it is still valid (it may come from another tab).
  useEffect(() => {
    if (API_ENABLED) void checkSession();
  }, []);
  return (
    <Page name="admin" title="Content studio, Daniel Al Kabbout">
      <UiProvider>
        {!API_ENABLED ? (
          <div className="adm-gate">
            <Ic n="lock" />
            <h2>The studio needs the API</h2>
            <p>Set VITE_API_URL to the API address, then reload this page.</p>
            <Link className="btn primary" to="/">
              Back to home
            </Link>
          </div>
        ) : session ? (
          <Loaded />
        ) : (
          <Login />
        )}
      </UiProvider>
    </Page>
  );
}

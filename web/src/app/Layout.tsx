import { useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { CommandPalette } from '../components/CommandPalette';
import { ToastProvider } from '../components/Toast';
import { Intro } from '../features/intro/Intro';
import { useSiteEffects } from '../hooks/useSiteEffects';
import { isPreview, PREVIEW_KEY, useContent } from '../api/content';
import { store } from '../lib/env';

function PreviewBanner() {
  if (!isPreview) return null;
  return (
    <div className="pv-banner">
      <b>Preview</b>
      <span>You are seeing unpublished changes. Only you can see this.</span>
      <Link to="/admin" className="pv-back">
        Back to the studio
      </Link>
      <button
        type="button"
        onClick={() => {
          store('session').remove(PREVIEW_KEY);
          window.location.reload();
        }}
      >
        Exit preview
      </button>
    </div>
  );
}

function Shell() {
  const [palette, setPalette] = useState(false);
  const { dataUpdatedAt } = useContent();
  useSiteEffects(dataUpdatedAt);
  return (
    <>
      <Intro />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="progress" id="prog" aria-hidden="true" />
      <Header onOpenPalette={() => setPalette(true)} />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <CommandPalette open={palette} setOpen={setPalette} />
      <Footer />
      <PreviewBanner />
      <ScrollRestoration />
    </>
  );
}

export function Layout() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

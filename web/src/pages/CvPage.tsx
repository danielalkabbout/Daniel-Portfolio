import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { useSite } from '../api/content';
import { buildCv, CV_NAME, SEP, type Run } from '../features/cv/cv';
import { duration, monthIndex } from '../lib/dates';
import { smooth } from '../lib/env';

const HOST = typeof window !== 'undefined' ? window.location.host : '';
const slug = (t: string) => `cv-${t.toLowerCase().replace(/[^a-z]+/g, '-')}`;

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r === SEP)
          return (
            <span key={i} className="cv-sep" aria-hidden="true">
              |
            </span>
          );
        const text = r.href ? (
          <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener">
            {r.t}
          </a>
        ) : (
          r.t
        );
        return r.b ? <b key={i}>{text}</b> : <Fragment key={i}>{text}</Fragment>;
      })}
    </>
  );
}

/**
 * The CV in the layout of Daniel's Word CV, built from the published content: a project, role or
 * skill added in the studio shows up here and in the downloaded PDF automatically.
 */
export default function CvPage() {
  const site = useSite();
  const say = useToast();
  const cv = useMemo(() => buildCv(site, HOST), [site]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(cv.sections[0]?.title ?? '');
  const sheetRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);

  // Facts for the side panel, all worked out from the content.
  const facts = useMemo(() => {
    const roles = site.experience.filter((e) => !e.milestone);
    const first = roles.reduce<string | null>(
      (m, r) => (m === null || monthIndex(r.start) < monthIndex(m) ? r.start : m),
      null,
    );
    return [
      ['Experience', first ? duration(first, null) : ''],
      ['Roles', `${roles.length} at ${new Set(roles.map((r) => r.org)).size} companies`],
      ['Projects', String(site.projects.filter((x) => x.visible).length)],
      ['Skills', String(site.skills.reduce((a, g) => a + g.items.length, 0))],
    ].filter(([, v]) => v);
  }, [site]);
  const updated = site.updatedAt
    ? new Date(site.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Printing uses the CV styles only (see .cv-mode in site.css).
  useEffect(() => {
    document.documentElement.classList.add('cv-mode');
    return () => document.documentElement.classList.remove('cv-mode');
  }, []);

  // The contents list follows your reading: current section and how far through the CV you are.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const io = new IntersectionObserver(
      (es) => {
        const seen = es
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive((seen[0].target as HTMLElement).dataset.title ?? '');
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    sheet.querySelectorAll('section').forEach((el) => io.observe(el));
    let frame = 0;
    const progress = () => {
      frame = 0;
      const r = sheet.getBoundingClientRect();
      const done = Math.min(1, Math.max(0, (innerHeight * 0.4 - r.top) / r.height));
      railRef.current?.style.setProperty('--read', done.toFixed(3));
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(progress);
    };
    progress();
    addEventListener('scroll', on, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener('scroll', on);
    };
  }, [cv]);

  const download = async () => {
    setBusy(true);
    try {
      const { downloadCvPdf } = await import('../features/cv/pdf');
      await downloadCvPdf(cv);
      say('CV downloaded');
    } catch {
      say('Could not make the PDF. Try again, or print the page and choose “Save as PDF”.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page name="cv" title={`${CV_NAME} - CV`}>
      <div className="cv-hero">
        <div className="wrap">
          <h1 tabIndex={-1}>My CV, always current</h1>
          <p>
            It is built from the same content as this site, so it changes whenever the site does. Read it here, or
            download it as an A4 PDF.
          </p>
        </div>
      </div>

      <div className="wrap cv-layout">
        <aside className="cv-rail" ref={railRef} aria-label="CV tools">
          <button type="button" className="cv-dl" disabled={busy} onClick={() => void download()}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
            </svg>
            <span>
              <b>{busy ? 'Preparing PDF…' : 'Download PDF'}</b>
              <small>A4, selectable text{updated ? `, updated ${updated}` : ''}</small>
            </span>
          </button>

          <nav className="cv-toc" aria-label="CV sections">
            <span className="cv-toc-bar" aria-hidden="true" />
            {cv.sections.map((s) => (
              <a
                key={s.title}
                href={`#${slug(s.title)}`}
                className={s.title === active ? 'on' : undefined}
                aria-current={s.title === active ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(slug(s.title))?.scrollIntoView({ behavior: smooth(), block: 'start' });
                }}
              >
                {s.title}
              </a>
            ))}
          </nav>

          <dl className="cv-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <Link className="cv-back" to="/about">
            More about me
          </Link>
        </aside>

        <div className="cv-paper">
          <article className="cv-sheet" aria-label="CV" ref={sheetRef}>
            <header className="cv-head">
              <h2>{cv.name}</h2>
              <p className="cv-headline">
                <Runs runs={cv.headline} />
              </p>
              {cv.contact.map((line, i) => (
                <p key={i} className="cv-contact">
                  <Runs runs={line} />
                </p>
              ))}
            </header>

            {cv.sections.map((s) => (
              <section key={s.title} id={slug(s.title)} data-title={s.title}>
                <h3>{s.title}</h3>
                {s.lines?.map((l, i) => (
                  <p key={i} className={s.title === 'Skills' ? 'cv-skill' : 'cv-para'}>
                    <Runs runs={l} />
                  </p>
                ))}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b, i) => (
                      <li key={i}>
                        <Runs runs={b} />
                      </li>
                    ))}
                  </ul>
                )}
                {s.entries?.map((e, i) => (
                  <div key={i} className="cv-entry">
                    <p className="cv-entry-head">
                      <Runs runs={e.head} />
                    </p>
                    {e.bullets.length > 0 && (
                      <ul>
                        {e.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </article>
        </div>
      </div>
    </Page>
  );
}

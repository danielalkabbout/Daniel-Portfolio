import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { useSite } from '../api/content';
import { buildCv, CV_NAME, SEP, type Run } from '../features/cv/cv';

const HOST = typeof window !== 'undefined' ? window.location.host : '';

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

  // Printing uses the CV styles only (see .cv-mode in site.css).
  useEffect(() => {
    document.documentElement.classList.add('cv-mode');
    return () => document.documentElement.classList.remove('cv-mode');
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      const { downloadCvPdf } = await import('../features/cv/pdf');
      await downloadCvPdf(cv);
    } catch {
      say('Could not make the PDF. Try again, or print the page and choose “Save as PDF”.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page name="cv" title={`${CV_NAME} - CV`}>
      <div className="wrap cv-page">
        <div className="cv-tools">
          <div>
            <h1 tabIndex={-1}>Curriculum vitae</h1>
            <p>Always up to date: built from the same content as this site.</p>
          </div>
          <div className="cv-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void download()}>
              {busy ? 'Preparing PDF…' : 'Download PDF'}
            </button>
            <Link className="btn" to="/about">
              Back to About
            </Link>
          </div>
        </div>

        <article className="cv-sheet" aria-label="CV">
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
            <section key={s.title}>
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
    </Page>
  );
}

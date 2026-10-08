import { useEffect } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { fmtMonth, monthIndex } from '../lib/dates';

const NAME = 'Daniel Al Kabbout';
const SITE = typeof window !== 'undefined' ? window.location.host : '';

const strip = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/**
 * A one-page CV built from the same content as the site, so it is never out of date.
 * "Download PDF" opens the browser's print dialog, where "Save as PDF" makes the file.
 */
export default function CvPage() {
  const site = useSite();
  const p = site.profile;
  const roles = site.experience
    .filter((e) => !e.milestone)
    .sort((a, b) => monthIndex(b.end) - monthIndex(a.end) || monthIndex(b.start) - monthIndex(a.start));
  // Every project shown on the site, in the studio's order: a project added there appears here too.
  const projects = site.projects.filter((x) => x.visible);

  // Printing uses the CV styles only (see .cv-mode in site.css).
  useEffect(() => {
    document.documentElement.classList.add('cv-mode');
    return () => document.documentElement.classList.remove('cv-mode');
  }, []);

  return (
    <Page name="cv" title={`${NAME} - CV`}>
      <div className="wrap cv-page">
        <div className="cv-tools">
          <div>
            <h1 tabIndex={-1}>Curriculum vitae</h1>
            <p>Always up to date: it is built from the same content as this site.</p>
          </div>
          <div className="cv-actions">
            <button type="button" className="btn primary" onClick={() => window.print()}>
              Download PDF
            </button>
            <Link className="btn" to="/about">
              Back to About
            </Link>
          </div>
          <p className="cv-hint">In the print window, choose “Save as PDF” as the printer.</p>
        </div>

        <article className="cv-sheet" aria-label="CV">
          <header className="cv-head">
            <div>
              <h2>{NAME}</h2>
              <p className="cv-role">{p.intro}</p>
            </div>
            <ul className="cv-contact">
              <li>
                <a href={`mailto:${p.email}`}>{p.email}</a>
              </li>
              {p.phone && <li>{p.phone}</li>}
              {p.linkedin && (
                <li>
                  <a href={p.linkedin}>{strip(p.linkedin)}</a>
                </li>
              )}
              {p.github && (
                <li>
                  <a href={p.github}>{strip(p.github)}</a>
                </li>
              )}
              {SITE && (
                <li>
                  <a href={`https://${SITE}`}>{SITE}</a>
                </li>
              )}
              <li>Lebanon · {p.status}</li>
            </ul>
          </header>

          <p className="cv-summary">
            {p.intro} {p.introRest}
          </p>

          <section>
            <h3>Experience</h3>
            {roles.map((e) => (
              <div className="cv-item" key={e.id}>
                <div className="cv-line">
                  <b>
                    {e.title} · {e.org}
                  </b>
                  <span>
                    {fmtMonth(e.start, true)} to {fmtMonth(e.end, true)}
                  </span>
                </div>
                {e.bullets.length > 0 && (
                  <ul>
                    {e.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          {projects.length > 0 && (
            <section>
              <h3>Projects</h3>
              {projects.map((x) => (
                <div className="cv-item" key={x.id}>
                  <div className="cv-line">
                    <b>{x.title}</b>
                    {x.kind && <span>{x.kind}</span>}
                  </div>
                  <p>{x.summary}</p>
                  {x.tags.length > 0 && <p className="cv-tags">{x.tags.join(' · ')}</p>}
                </div>
              ))}
            </section>
          )}

          <section>
            <h3>Skills</h3>
            <dl className="cv-skills">
              {site.skills.map((s) => (
                <div key={s.name}>
                  <dt>{s.name}</dt>
                  <dd>{s.items.join(', ')}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="cv-cols">
            {(
              [
                ['Education', site.education],
                ['Certifications', site.certifications],
                ['Languages', site.languages],
                ['Volunteering', site.volunteering],
              ] as const
            )
              .filter(([, list]) => list.length > 0)
              .map(([title, list]) => (
                <section key={title}>
                  <h3>{title}</h3>
                  {list.map((t, i) => (
                    <p key={i} className="cv-small">
                      <b>{t.title}</b>
                      {t.detail && <span> · {t.detail}</span>}
                    </p>
                  ))}
                </section>
              ))}
          </div>
        </article>
      </div>
    </Page>
  );
}

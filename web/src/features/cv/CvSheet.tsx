import { Fragment, type Ref } from 'react';
import { SEP, type Cv, type Run } from './cv';

export const cvSlug = (t: string) => `cv-${t.toLowerCase().replace(/[^a-z]+/g, '-')}`;

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

/** The CV sheet in the Word CV's layout. Used by the CV page and the studio's live preview. */
export function CvSheet({ cv, sheetRef }: { cv: Cv; sheetRef?: Ref<HTMLElement> }) {
  return (
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
        <section key={s.key} id={cvSlug(s.title)} data-title={s.title} data-key={s.key}>
          <h3>{s.title}</h3>
          {s.lines?.map((l, i) => (
            <p key={i} className={s.key === 'skills' ? 'cv-skill' : 'cv-para'}>
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
  );
}

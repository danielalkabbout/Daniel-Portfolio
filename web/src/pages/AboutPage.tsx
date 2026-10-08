import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { finePointer, reduceMotion } from '../lib/env';
import { SearchIcon } from '../lib/icons';
import cutout from '../assets/daniel-cutout.webp';
import type { SiteContent } from '../types/content';
import { pageText } from '../content/defaults';

type TextItem = SiteContent['education'][number];

function FactBox({ title, items, certs }: { title: string; items: TextItem[]; certs?: boolean }) {
  const list = items.filter((x) => x.title);
  if (!list.length) return null;
  return certs ? (
    <div>
      <h3>{title}</h3>
      <ul className="certs">
        {list.map((x, i) => (
          <li key={i}>
            {x.title}
            <span>{x.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <div>
      <h3>{title}</h3>
      {list.map((x, i) => (
        <p key={i}>
          {x.title}
          <span>{x.detail}</span>
        </p>
      ))}
    </div>
  );
}

/** Photo that drifts slightly with the pointer. */
function usePhotoParallax(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const f = ref.current;
    const h = f?.closest<HTMLElement>('.page-hero');
    if (!f || !h || reduceMotion() || !finePointer()) return;
    const move = (e: PointerEvent) => {
      const r = f.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      f.style.setProperty('--phx', (x * 14).toFixed(1));
      f.style.setProperty('--phy', (y * 14).toFixed(1));
    };
    const leave = () => {
      f.style.setProperty('--phx', '0');
      f.style.setProperty('--phy', '0');
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerleave', leave);
    return () => {
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerleave', leave);
    };
  }, [ref]);
}

export default function AboutPage() {
  const site = useSite();
  const text = pageText(site, 'about');
  const photoRef = useRef<HTMLElement>(null);
  const [q, setQ] = useState('');
  usePhotoParallax(photoRef);

  const query = q.trim().toLowerCase();
  const total = site.skills.reduce((a, g) => a + g.items.length, 0);
  const hits = query
    ? site.skills.reduce((a, g) => a + g.items.filter((s) => s.toLowerCase().includes(query)).length, 0)
    : 0;
  const countText = !query
    ? `${total} skills across ${site.skills.length} areas`
    : hits
      ? `${hits} ${hits === 1 ? 'match' : 'matches'}`
      : 'No match yet. Ask me about it through the services page.';

  return (
    <Page name="about" title="About, Daniel Al Kabbout">
      <div className="page-hero">
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="wrap about-hero">
          <div>
            {text.kicker && <p className="title-line">{text.kicker}</p>}
            <h1 tabIndex={-1}>{text.title}</h1>
            {text.intro && <p>{text.intro}</p>}
            <div className="more">
              <Link className="btn primary" to="/services">
                Request my services
              </Link>
              <Link className="btn" to="/cv">
                Download my CV
              </Link>
              <a className="btn" href={`mailto:${site.profile.email}`}>
                Email me
              </a>
            </div>
          </div>
          <figure className="me-cut" id="mePhoto" ref={photoRef}>
            <div className="me-orb" aria-hidden="true" />
            <img src={cutout} alt="Daniel Al Kabbout" width="560" height="716" />
            <span className="me-chip c1" aria-hidden="true">
              Azure OpenAI
            </span>
            <span className="me-chip c2" aria-hidden="true">
              Copilot Studio
            </span>
            <figcaption>
              <b>Daniel Al Kabbout</b>
              <span>AI Software Engineer, SoftFlow Group</span>
            </figcaption>
          </figure>
        </div>
      </div>
      <section>
        <div className="wrap about-grid">
          <div className="story">
            {text.lead && <p className="big">{text.lead}</p>}
            {text.paragraphs.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            <div className="more">
              <Link className="btn primary" to="/services">
                Request my services
              </Link>
              <Link className="btn" to="/experience">
                See my experience
              </Link>
            </div>
          </div>
          <div className="facts">
            <FactBox title="Education" items={site.education} />
            <FactBox title="Certifications" items={site.certifications} certs />
            <FactBox title="Languages" items={site.languages} />
            <FactBox title="Volunteering" items={site.volunteering} />
          </div>
        </div>
      </section>
      <section style={{ paddingTop: 0 }} id="skills">
        <div className="wrap">
          <div className="head">
            <h2>Skills</h2>
            <div className="skill-search">
              <label htmlFor="skillQ">Looking for something specific?</label>
              <div className="sq">
                <SearchIcon />
                <input
                  id="skillQ"
                  type="search"
                  placeholder="Try RAG, Docker or SPFx"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <p aria-live="polite">{countText}</p>
            </div>
          </div>
          <div className={clsx('skills wide', query && 'searching')}>
            {site.skills.map((g, i) => {
              const any = !query || g.items.some((s) => s.toLowerCase().includes(query));
              return (
                <div key={g.name} className={clsx('sk', i === 0 && 'lead', !any && 'none')}>
                  <h3>{g.name}</h3>
                  {i === 0 && g.desc && <p>{g.desc}</p>}
                  <ul>
                    {g.items.map((s) => (
                      <li key={s} className={query && s.toLowerCase().includes(query) ? 'hit' : undefined}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Page>
  );
}

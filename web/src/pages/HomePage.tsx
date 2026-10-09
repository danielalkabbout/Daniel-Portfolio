import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { EchoChat } from '../features/echo/EchoChat';
import { NetCanvas } from '../features/home/NetCanvas';
import { useHomeScroll } from '../features/home/useHomeScroll';
import { ArrowRight, Icon } from '../lib/icons';
import { reduceMotion } from '../lib/env';
import { pageLayout, pageText } from '../content/defaults';
import type { PageCard } from '../types/content';

const KEY_WORD = /^(disappears|AI|agents,?|WhatsApp|bots,?|web|mobile|apps|never)/;
const REEL_COLORS: [string, string][] = [
  ['sky', 'mint'],
  ['mint', 'sun'],
  ['sun', 'sky'],
  ['sky', 'sun'],
  ['mint', 'sky'],
];

function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (words.length < 2) return;
    const reduce = reduceMotion();
    let swap: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      if (document.hidden) return;
      if (reduce) {
        setI((n) => (n + 1) % words.length);
        return;
      }
      setOut(true);
      swap = setTimeout(() => {
        setOut(false);
        setEntered(true);
        setI((n) => (n + 1) % words.length);
      }, 360);
    }, 2600);
    return () => {
      clearInterval(t);
      clearTimeout(swap);
    };
  }, [words.length]);
  const w = words[i % Math.max(words.length, 1)] ?? '';
  return (
    <span className="rot" id="rot">
      <span key={i} className={out ? 'rot-w out' : entered ? 'rot-w in' : 'rot-w'}>
        {w}
      </span>
    </span>
  );
}

function Counter({ n }: { n: string }) {
  const m = String(n).match(/^([^\d]*)(\d+)(.*)$/);
  const countable = m && !m[3];
  return countable ? (
    <strong data-count={m[2]} data-prefix={m[1] || undefined}>
      {n}
    </strong>
  ) : (
    <strong>{n}</strong>
  );
}

/** Counts the highlight numbers up from zero the first time they scroll into view. */
function useCounters(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let done = false;
    const start = () => {
      if (done) return;
      const r = box.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0) return;
      done = true;
      box.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const to = Number(el.dataset.count);
        const pre = el.dataset.prefix || '';
        if (reduceMotion()) {
          el.textContent = pre + to;
          return;
        }
        let t0: number | null = null;
        const step = (t: number) => {
          if (t0 === null) t0 = t;
          const k = Math.min((t - t0) / 1300, 1);
          const e = 1 - Math.pow(1 - k, 3);
          el.textContent = pre + Math.round(to * e);
          if (k < 1) requestAnimationFrame(step);
        };
        el.textContent = `${pre}0`;
        requestAnimationFrame(step);
      });
    };
    addEventListener('scroll', start, { passive: true });
    const t = setTimeout(start, 400);
    return () => {
      removeEventListener('scroll', start);
      clearTimeout(t);
    };
  }, [ref]);
}

export default function HomePage() {
  const site = useSite();
  const text = pageText(site, 'home');
  const sec = text.sections;
  const [ctaServices, ctaAbout] = sec.hero.cards;
  const reelEnd = sec.reel.cards[0];
  const p = site.profile;
  const heroRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const words = p.rotating.filter((w) => w.trim());
  const reel = site.projects.filter((x) => x.visible !== false && x.home !== false);

  useCounters(proofRef);
  const layout = pageLayout(site, 'home');
  useHomeScroll(pageRef, reel.length, layout.join());

  const blocks: Record<string, React.ReactNode> = {
    strip: (
      <div className="strip" aria-label={sec.strip.title}>
        <div className="wrap strip-row">
          <p>{sec.strip.title}</p>
          <div className="strip-view">
            <div className="strip-track">
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1 || undefined}>
                  {text.items.flatMap((s) => [
                    <li key={s}>{s}</li>,
                    <li key={`${s}-dot`} className="dot" aria-hidden="true">
                      ✦
                    </li>,
                  ])}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    mani: (
      <section className="mani" id="mani" aria-label="About my work">
        <div className="mani-in">
          <div className="wrap">
            <p className="mani-text" id="maniText">
              {text.lead.split(' ').map((w, i) => (
                <Fragment key={i}>
                  <span className={KEY_WORD.test(w) ? 'w key' : 'w'}>{w}</span>{' '}
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      </section>
    ),
    agents: <StoryPin title={sec.agents.title} steps={sec.agents.cards} />,
    proof: (
      <section>
        <div className="wrap">
          <div className="head">
            <h2>{sec.proof.title}</h2>
            {sec.proof.intro && <p>{sec.proof.intro}</p>}
          </div>
          <div className="proof" ref={proofRef}>
            {site.highlights.map((h, i) => (
              <div key={i}>
                <Counter n={h.n} />
                <span>{h.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    reel: (
      <section className="reel" id="reel" aria-label="Selected projects">
        <div className="reel-in">
          <div className="wrap reel-head">
            <h2>{sec.reel.title}</h2>
            {sec.reel.intro && <p>{sec.reel.intro}</p>}
          </div>
          <div className="reel-track" id="reelTrack">
            {reel.map((x, i) => {
              const [c1, c2] = REEL_COLORS[i % REEL_COLORS.length];
              return (
                <Link
                  key={x.id}
                  className="rc"
                  to={`/projects/${x.id}`}
                  style={{ '--c1': `var(--${c1})`, '--c2': `var(--${c2})` } as React.CSSProperties}
                >
                  <div className="rc-art">
                    <Icon name={x.icon || x.demo} sw={1.6} />
                  </div>
                  <h3>{x.title}</h3>
                  <p>{x.reel || x.summary}</p>
                  <span className="rc-st">{x.tags.slice(0, 3).join(', ')}</span>
                </Link>
              );
            })}
            <Link className="rc rc-end" to="/projects">
              <h3>{reelEnd.title}</h3>
              <p>{reelEnd.text}</p>
              <span className="btn primary">{reelEnd.label}</span>
            </Link>
          </div>
        </div>
      </section>
    ),
    marquee: (
      <div className="marq" aria-hidden="true">
        {[
          { words: sec.marqueeTop.words, speed: 0.35, cls: 'mrow' },
          { words: sec.marqueeBottom.words, speed: -0.28, cls: 'mrow ol' },
        ].map((row) => (
          <div key={row.cls} className={row.cls} data-speed={row.speed}>
            {[...row.words, ...row.words].flatMap((w, i) => [<span key={i}>{w}</span>, <b key={`b${i}`}>✦</b>])}
          </div>
        ))}
      </div>
    ),
    now: (
      <section>
        <div className="wrap">
          <div className="head">
            <h2>{sec.now.title}</h2>
            {sec.now.intro && <p>{sec.now.intro}</p>}
          </div>
          <div className="teaser">
            {sec.now.cards.map((x, i) => (
              <article key={i} data-stage={x.stage || undefined}>
                {x.label && (
                  <span className="who">
                    {x.stage && <i aria-hidden="true" />}
                    {x.label}
                  </span>
                )}
                <h3>{x.title}</h3>
                {x.text && <p>{x.text}</p>}
                {x.tags.length > 0 && (
                  <ul className="teaser-tags" aria-label="Built with">
                    {x.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
          <div className="more">
            <Link className="btn primary" to="/projects">
              See my projects
            </Link>
            <Link className="btn" to="/experience">
              See my experience
            </Link>
          </div>
        </div>
      </section>
    ),
  };

  return (
    <Page name="home" title="Daniel Al Kabbout, AI Software Engineer">
      <div ref={pageRef}>
        <div className="hero" id="hero" ref={heroRef}>
          <NetCanvas hero={heroRef} />
          <div className="aurora" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="wrap">
            <div>
              <div className="status">
                <b aria-hidden="true" />
                {p.status}
              </div>
              <p className="hello">
                <span className="wave-hand" aria-hidden="true" />
                {p.hello}
              </p>
              <h1 tabIndex={-1} aria-label={`${p.headline} ${words.join(', ')}`}>
                <span aria-hidden="true">
                  {p.headline} <RotatingWord words={words} />
                </span>
              </h1>
              <p className="intro">
                <strong>{p.intro}</strong> {p.introRest}
              </p>
              <div className="choices">
                <Link className="choice primary" to="/services">
                  <b>
                    {ctaServices.title}
                    <ArrowRight />
                  </b>
                  <span>{ctaServices.text}</span>
                </Link>
                <Link className="choice" to="/about">
                  <b>
                    {ctaAbout.title}
                    <ArrowRight />
                  </b>
                  <span>{ctaAbout.text}</span>
                </Link>
              </div>
            </div>
            <div>
              <EchoChat />
              <p className="chat-note">{sec.hero.intro}</p>
            </div>
          </div>
        </div>

        {layout.map((k) => (
          <Fragment key={k}>{blocks[k]}</Fragment>
        ))}
      </div>
    </Page>
  );
}

const DOC_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
const DB_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);

/** The pinned "how my agents work" story; useHomeScroll drives the steps as you scroll. */
function StoryPin({ title, steps }: { title: string; steps: PageCard[] }) {
  return (
    <section className="story-pin" id="storyPin" aria-label="How one of my AI agents answers a question">
      <div className="sp-in">
        <div className="wrap sp-grid">
          <div className="sp-text">
            <p className="title-line">{title}</p>
            <ol className="st-list" id="stList">
              {steps.map((st, i) => (
                <li key={i} data-s={i} className={i === 0 ? 'on' : undefined}>
                  <h3>{st.title}</h3>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="sp-stage-wrap">
            <div className="stage" id="stage" data-step="0">
              <div className="st-bar" aria-hidden="true">
                <i id="stBar" />
              </div>
              <div className="st-phone">
                <div className="st-top">
                  <span className="st-av">AI</span>
                  <div>
                    <b>Company agent</b>
                    <small id="stPlat">in Microsoft Teams</small>
                  </div>
                </div>
                <div className="st-body">
                  <div className="sb sb-q">What's the leave policy for new employees?</div>
                  <div className="st-search">
                    <div className="st-scan" aria-hidden="true" />
                    <p>Searching your data</p>
                    <div className="st-src s1">
                      {DOC_ICON}
                      <span>
                        HR Policy.docx<small>SharePoint</small>
                      </span>
                      <em>match</em>
                    </div>
                    <div className="st-src s2">
                      {DB_ICON}
                      <span>
                        Employees table<small>SQL Server</small>
                      </span>
                      <em>match</em>
                    </div>
                  </div>
                  <div className="sb sb-a">
                    Found it in <b>HR Policy.docx</b>: new employees can request annual leave once their probation
                    period ends.
                    <span className="cite">Source: SharePoint</span>
                  </div>
                </div>
              </div>
              <div className="st-scope">
                <b>Agent scope</b>
                <p>
                  <span>Can access</span>HR documents and the employees table
                </p>
                <p>
                  <span>Used by</span>All staff, in Teams
                </p>
                <p>
                  <span>Should not</span>Share anyone's personal data
                </p>
              </div>
            </div>
            <p className="st-note">Example conversation, for illustration.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

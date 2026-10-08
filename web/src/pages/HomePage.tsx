import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { EchoChat } from '../features/echo/EchoChat';
import { NetCanvas } from '../features/home/NetCanvas';
import { useHomeScroll } from '../features/home/useHomeScroll';
import { ArrowRight, Icon } from '../lib/icons';
import { reduceMotion } from '../lib/env';
import { pageText } from '../content/defaults';

const MARQ1 = ['AI agents', 'WhatsApp bots', 'Websites', 'Mobile apps', 'SharePoint', 'Backend APIs'];
const MARQ2 = ['Azure OpenAI', 'Copilot Studio', 'Microsoft Teams', 'C# and .NET', 'Spring Boot', 'React'];
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
  const p = site.profile;
  const heroRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const words = p.rotating.filter((w) => w.trim());
  const reel = site.projects.filter((x) => x.visible !== false && x.home !== false);

  useCounters(proofRef);
  useHomeScroll(pageRef, reel.length);

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
                    Request my services
                    <ArrowRight />
                  </b>
                  <span>AI agents, WhatsApp bots, websites, mobile apps and more</span>
                </Link>
                <Link className="choice" to="/about">
                  <b>
                    Get to know me
                    <ArrowRight />
                  </b>
                  <span>My background, skills and education</span>
                </Link>
              </div>
            </div>
            <div>
              <EchoChat />
              <p className="chat-note">Type a question or tap a suggestion. Echo answers only from Daniel's CV.</p>
            </div>
          </div>
        </div>

        <div className="strip" aria-label="What I work on">
          <div className="wrap strip-row">
            <p>What I work on</p>
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

        <StoryPin />

        <section>
          <div className="wrap">
            <div className="head">
              <h2>Since September 2024</h2>
              <p>Delivered at SoftFlow Group, for internal teams and clients.</p>
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

        <section className="reel" id="reel" aria-label="Selected projects">
          <div className="reel-in">
            <div className="wrap reel-head">
              <h2>Selected projects</h2>
              <p>Keep scrolling to move through them.</p>
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
                <h3>See every project in detail</h3>
                <p>Diagrams, a live pipeline demo and links to the code.</p>
                <span className="btn primary">Open projects</span>
              </Link>
            </div>
          </div>
        </section>

        <div className="marq" aria-hidden="true">
          {[
            { words: MARQ1, speed: 0.35, cls: 'mrow' },
            { words: MARQ2, speed: -0.28, cls: 'mrow ol' },
          ].map((row) => (
            <div key={row.cls} className={row.cls} data-speed={row.speed}>
              {[...row.words, ...row.words].flatMap((w, i) => [<span key={i}>{w}</span>, <b key={`b${i}`}>✦</b>])}
            </div>
          ))}
        </div>

        <section>
          <div className="wrap">
            <div className="head">
              <h2>What I'm working on</h2>
              <p>Recent work as AI Software Engineer and Technical Lead.</p>
            </div>
            <div className="teaser">
              <article>
                <span className="who">Microsoft Teams</span>
                <h3>Two Copilot Studio agents</h3>
                <p>They answer staff questions from SharePoint documents and SQL Server data, right inside Teams.</p>
              </article>
              <article>
                <span className="who">The Net Holding</span>
                <h3>WhatsApp bot and Meta verification</h3>
                <p>
                  Built on the WhatsApp Cloud API. I also took them through Meta Business Verification, fixing rejected
                  documents and verifying the domain.
                </p>
              </article>
              <article>
                <span className="who">In progress</span>
                <h3>AI for a social media product</h3>
                <p>Adding AI features with Azure OpenAI to an enterprise social media product.</p>
              </article>
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

const STEPS = [
  ['A question comes in', 'Staff ask in plain language, inside Microsoft Teams or WhatsApp. No new app to learn.'],
  [
    'The agent finds the right data',
    'It searches SharePoint documents and SQL Server data using retrieval-augmented generation.',
  ],
  [
    'It answers, with the source',
    'The reply is grounded in your own documents, so people can check where it came from.',
  ],
  ["Scoped before it's built", 'We agree up front on what data it can access, who uses it, and what it should not do.'],
];

/** The pinned "how my agents work" story; useHomeScroll drives the steps as you scroll. */
function StoryPin() {
  return (
    <section className="story-pin" id="storyPin" aria-label="How one of my AI agents answers a question">
      <div className="sp-in">
        <div className="wrap sp-grid">
          <div className="sp-text">
            <p className="title-line">How my agents work</p>
            <ol className="st-list" id="stList">
              {STEPS.map(([h, t], i) => (
                <li key={h} data-s={i} className={i === 0 ? 'on' : undefined}>
                  <h3>{h}</h3>
                  <p>{t}</p>
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

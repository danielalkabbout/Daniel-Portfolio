import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useSite } from '../api/content';
import { copyText, smooth } from '../lib/env';
import { ChatIcon, GitHubIcon, LinkedInIcon, MailIcon } from '../lib/icons';

function beirutTime() {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Beirut' }).format(
      new Date(),
    );
  } catch {
    return '';
  }
}

export function Footer() {
  const { profile: p } = useSite();
  const ref = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLButtonElement>(null);
  const [time, setTime] = useState(beirutTime);
  const [copied, setCopied] = useState(false);
  const [year] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const t = setInterval(() => setTime(beirutTime()), 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ft = ref.current;
    const top = topRef.current;
    if (!ft || !top) return;
    const prog = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      top.style.setProperty('--sp2', h > 0 ? (scrollY / h).toFixed(3) : '0');
    };
    addEventListener('scroll', prog, { passive: true });
    prog();
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) ft.classList.add('in');
          else if (e.boundingClientRect.top > 0) ft.classList.remove('in');
        }),
      { threshold: 0.25 },
    );
    io.observe(ft);
    return () => {
      removeEventListener('scroll', prog);
      io.disconnect();
    };
  }, []);

  const copy = async () => {
    if (await copyText(p.email)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else window.location.href = `mailto:${p.email}`;
  };

  return (
    <footer className="ft" id="ft" ref={ref}>
      <div className="ft-glow" aria-hidden="true" />
      <div className="wrap">
        <div className="ft-cta">
          <div>
            <p className="ft-kicker">
              <b aria-hidden="true" />
              Available for new projects
            </p>
            <h2>
              Have an idea?
              <br />
              <span>Let's build it.</span>
            </h2>
          </div>
          <div className="ft-actions">
            <Link className="ft-big" to="/services">
              <span>Request a service</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </Link>
            <button className={copied ? 'ft-copy done' : 'ft-copy'} type="button" onClick={() => void copy()}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
              <span>{copied ? 'Copied to clipboard' : p.email}</span>
            </button>
          </div>
        </div>

        <div className="ft-grid">
          <div className="ft-about">
            <p>
              AI Software Engineer and Technical Lead at SoftFlow Group. I build AI agents, WhatsApp bots, web and
              mobile apps, and the backends behind them.
            </p>
            <div className="ft-clock">
              <span className="ft-dot" aria-hidden="true" />
              <span>
                Lebanon, local time <b>{time || '--:--'}</b>
              </span>
            </div>
          </div>
          <nav aria-label="Footer">
            <h3>Explore</h3>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/experience">Experience</Link>
            <Link to="/projects">Projects</Link>
            <Link to="/services">Services</Link>
          </nav>
          <div>
            <h3>Services</h3>
            <Link to="/services">AI agents</Link>
            <Link to="/services">WhatsApp bots</Link>
            <Link to="/services">Websites and web apps</Link>
            <Link to="/services">Mobile apps</Link>
            <Link to="/services">SharePoint and backend</Link>
          </div>
          <div>
            <h3>Connect</h3>
            <a href={`mailto:${p.email}`} className="ft-soc">
              <MailIcon />
              Email
            </a>
            <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener" className="ft-soc">
              <ChatIcon />
              WhatsApp
            </a>
            <a href={p.linkedin} target="_blank" rel="noopener" className="ft-soc">
              <LinkedInIcon />
              LinkedIn
            </a>
            <a href={p.github} target="_blank" rel="noopener" className="ft-soc">
              <GitHubIcon />
              GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="ft-sig" aria-hidden="true">
        <span>Daniel Al Kabbout</span>
      </div>

      <div className="wrap ft-bottom">
        <span>© {year} Daniel Al Kabbout. Designed and built with care in Lebanon.</span>
        <button
          className="ft-top"
          type="button"
          aria-label="Back to top"
          ref={topRef}
          onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
        >
          <svg className="ring" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r="20" pathLength={100} />
            <circle className="pr" cx="22" cy="22" r="20" pathLength={100} />
          </svg>
          <svg
            className="ar"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
    </footer>
  );
}

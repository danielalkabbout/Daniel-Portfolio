import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { smooth } from '../lib/env';
import { ArrowUpRight, GitHubIcon, Icon } from '../lib/icons';
import { DEMOS } from '../features/projects/demos';
import type { Project } from '../types/content';

function ProjectArticle({ p }: { p: Project }) {
  const demo = p.demo ? DEMOS[p.demo] : undefined;
  return (
    <article className="pj" id={`pj-${p.id}`}>
      <header className="pj-head">
        <span className="pj-ic">
          <Icon name={p.icon || p.demo} />
        </span>
        <div>
          <span className="kind">{p.kind}</span>
          <h2>{p.title}</h2>
        </div>
      </header>
      <p className="pj-lede">{p.summary}</p>
      {demo ? (
        demo()
      ) : p.image ? (
        <div className="pj-stage pj-img">
          <img src={p.image} alt={`${p.title} screenshot`} loading="lazy" />
        </div>
      ) : null}
      <div className="pj-info">
        <ul className="feats">
          {p.features.filter(Boolean).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <div>
          <div className="tags">
            {p.tags.filter(Boolean).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          {(p.github || p.live) && (
            <div className="pj-links">
              {p.github && (
                <a className="pj-link" href={p.github} target="_blank" rel="noopener">
                  <GitHubIcon />
                  Code on GitHub
                </a>
              )}
              {p.live && (
                <a className="pj-link" href={p.live} target="_blank" rel="noopener">
                  <ArrowUpRight />
                  Live site
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const site = useSite();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projects = site.projects.filter((p) => p.visible !== false);
  const [active, setActive] = useState(projects[0]?.id ?? '');
  const indexRef = useRef<HTMLOListElement>(null);
  const clicked = useRef(false);

  // Deep links like /projects/noise open at that project.
  useEffect(() => {
    if (clicked.current) {
      clicked.current = false;
      return;
    }
    if (!projectId) return;
    const t = setTimeout(() => document.getElementById(`pj-${projectId}`)?.scrollIntoView({ behavior: 'auto' }), 120);
    return () => clearTimeout(t);
  }, [projectId]);

  // Highlight the project you are reading in the side index.
  useEffect(() => {
    const spy = () => {
      const arts = Array.from(document.querySelectorAll<HTMLElement>('.pj'));
      if (!arts.length) return;
      let cur = arts[0].id;
      const mark = innerHeight * 0.35;
      arts.forEach((a) => {
        if (a.getBoundingClientRect().top < mark) cur = a.id;
      });
      setActive(cur.replace(/^pj-/, ''));
    };
    addEventListener('scroll', spy, { passive: true });
    const t = setTimeout(spy, 100);
    return () => {
      removeEventListener('scroll', spy);
      clearTimeout(t);
    };
  }, []);

  // On narrow screens the index is a horizontal strip: keep the active item in view.
  useEffect(() => {
    if (innerWidth >= 980) return;
    const ol = indexRef.current;
    const li = ol?.querySelector<HTMLElement>(`a[data-pj="${active}"]`)?.parentElement;
    if (ol && li) ol.scrollTo({ left: li.offsetLeft - 12, behavior: 'smooth' });
  }, [active]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(`pj-${id}`)?.scrollIntoView({ behavior: smooth() });
    clicked.current = true;
    navigate(`/projects/${id}`, { replace: true, preventScrollReset: true });
  };

  return (
    <Page name="projects" title="Projects, Daniel Al Kabbout">
      <div className="page-hero">
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="wrap">
          <p className="title-line">Projects</p>
          <h1 tabIndex={-1}>Things I've built.</h1>
          <p>Personal projects and work I can share. Most of them are on GitHub.</p>
        </div>
      </div>
      <section className="pj-sec">
        <div className="wrap pj-layout">
          <nav className="pj-index" aria-label="Projects on this page">
            <p>Projects</p>
            <ol ref={indexRef}>
              {projects.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/projects/${p.id}`}
                    data-pj={p.id}
                    className={clsx(active === p.id && 'on')}
                    onClick={(e) => go(e, p.id)}
                  >
                    <i>
                      <Icon name={p.icon || p.demo} />
                    </i>
                    <span>
                      <b>{p.short || p.title}</b>
                      <small>{p.tagline || p.kind}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="pj-list">
            {projects.map((p) => (
              <ProjectArticle key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

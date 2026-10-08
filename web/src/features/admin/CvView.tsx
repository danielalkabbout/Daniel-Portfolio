import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { buildCv } from '../cv/cv';
import { CvSheet } from '../cv/CvSheet';
import { CV_SECTION_TITLES, DEFAULT_CV, type CvSectionKey } from '../../content/defaults';
import type { CvSettings, SiteContent } from '../../types/content';
import { ChipsField } from './fields';
import { Ic, useUi } from './ui';
import { useStudio } from './studio-state';
import { Head, projectSpec, roleSpec } from './views';

const HOST = typeof window !== 'undefined' ? window.location.host : '';
// A4 at 96 dpi, and the printable height inside the CV's top and bottom margins (42.5pt each).
const SHEET_PX = (595.28 * 96) / 72;
const PAGE_PX = ((841.89 - 85) * 96) / 72;

/** How many entries each section has, so the list says what each one holds. */
function counts(d: SiteContent): Record<CvSectionKey, string> {
  const roles = d.experience.filter((e) => !e.milestone && e.cv).length;
  const projects = d.projects.filter((p) => p.visible && p.cv).length;
  const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
  return {
    summary: `${d.cv.summary.trim().length} characters`,
    skills: n(d.skills.length, 'group'),
    experience: n(roles, 'role'),
    projects: n(projects, 'project'),
    education: n(d.education.length, 'entry', 'entries'),
    certifications: n(d.certifications.length, 'certificate'),
    languages: n(d.languages.length, 'language'),
    volunteering: n(d.volunteering.length, 'entry', 'entries'),
  };
}

function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="adm-mini-sw" title={label}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} aria-label={label} />
      <span className="adm-sw" />
    </label>
  );
}

/** Live preview: the CV exactly as the page and the PDF draw it, scaled to fit, with a page count. */
function Preview({ d, focus }: { d: SiteContent; focus: CvSectionKey | null }) {
  const { toast } = useUi();
  const cv = useMemo(() => buildCv(d, HOST), [d]);
  const boxRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(0);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const sheet = sheetRef.current;
    if (!box || !sheet) return;
    const measure = () => {
      setScale(Math.min(1, box.clientWidth / SHEET_PX));
      setHeight(sheet.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);

  // Bring the section you are editing into view and mark it.
  useEffect(() => {
    const sheet = sheetRef.current;
    sheet?.querySelectorAll('section.on').forEach((el) => el.classList.remove('on'));
    if (!focus || !sheet) return;
    const el = sheet.querySelector<HTMLElement>(`section[data-key="${focus}"]`);
    if (!el) return;
    el.classList.add('on');
    const scroller = boxRef.current?.parentElement;
    if (scroller) scroller.scrollTo({ top: Math.max(0, el.offsetTop * scale - 40), behavior: 'smooth' });
  }, [focus, scale, cv]);

  // Content height without the sheet's own top and bottom padding.
  const pages = height ? Math.max(1, Math.ceil((height - (85 * 96) / 72) / PAGE_PX)) : 0;

  const download = async () => {
    setBusy(true);
    try {
      const { downloadCvPdf } = await import('../cv/pdf');
      await downloadCvPdf(cv);
      toast('PDF downloaded from your draft');
    } catch {
      toast('Could not make the PDF. Try again.', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="adm-cvpv" aria-label="CV preview">
      <div className="adm-cvpv-bar">
        <span className={pages > 2 ? 'adm-cvpages warn' : 'adm-cvpages'}>
          <Ic n="cv" />
          {pages ? `About ${pages} page${pages > 1 ? 's' : ''}` : 'Measuring…'}
        </span>
        <button type="button" className="adm-btn ghost" disabled={busy} onClick={() => void download()}>
          <Ic n="data" />
          {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
      <div className="adm-cvpv-scroll">
        <div className="adm-cvpv-box" ref={boxRef} style={{ height: height * scale || undefined }}>
          <div className="adm-cvpv-scale" style={{ transform: `scale(${scale})` }}>
            <CvSheet cv={cv} sheetRef={sheetRef} />
          </div>
        </div>
      </div>
      {pages > 2 && (
        <p className="adm-cvpv-note">
          <Ic n="info" />
          Most recruiters prefer two pages. Hide a section or leave older projects off the CV to shorten it.
        </p>
      )}
    </aside>
  );
}

export function CvView() {
  const { d, update, open } = useStudio();
  const { toast } = useUi();
  const ctx = { update, toast };
  const cv = d.cv;
  const [focus, setFocus] = useState<CvSectionKey | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const n = counts(d);

  const set = (fn: (c: CvSettings) => void) => update((x) => fn(x.cv));
  const move = (from: number, to: number) =>
    set((c) => {
      if (to < 0 || to >= c.sections.length) return;
      const [s] = c.sections.splice(from, 1);
      c.sections.splice(to, 0, s);
    });

  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (drag !== null && drag !== to) move(drag, to);
    setDrag(null);
  };

  const summaryLen = cv.summary.trim().length;
  const roles = d.experience.filter((e) => !e.milestone);
  const projects = d.projects.filter((p) => p.visible);

  return (
    <>
      <Head
        title="CV"
        desc="Everything you add in Projects, Experience, Skills and About details goes on your CV automatically. Here you choose the wording, the order and what to leave out. The preview updates as you type."
      />
      <div className="adm-cv">
        <div className="adm-cv-edit">
          <section className="adm-card">
            <h3>Header</h3>
            <ChipsField
              label="Headline under your name"
              value={cv.headline}
              onChange={(v) => set((c) => void (c.headline = v))}
              ph="e.g. AI Software Engineer"
              help={
                <>
                  Shown as <b>{(cv.headline.length ? cv.headline : DEFAULT_CV.headline).join('  |  ')}</b>. Up to four
                  parts.
                </>
              }
            />
            <div className="adm-row2 adm-cv-row">
              <label className="adm-field">
                <span>Location</span>
                <input
                  value={cv.location}
                  maxLength={80}
                  placeholder={DEFAULT_CV.location}
                  onChange={(e) => set((c) => void (c.location = e.target.value))}
                />
              </label>
              <label className="adm-field">
                <span>Availability</span>
                <input
                  value={cv.availability}
                  maxLength={80}
                  placeholder={DEFAULT_CV.availability}
                  onChange={(e) => set((c) => void (c.availability = e.target.value))}
                />
              </label>
            </div>
            <label className="adm-switch">
              <input
                type="checkbox"
                checked={cv.showWebsite}
                onChange={(e) => set((c) => void (c.showWebsite = e.target.checked))}
              />
              <span className="adm-sw" />
              <span>
                <b>Link to this website</b>
                <small>Adds {HOST || 'your site address'} next to LinkedIn and GitHub.</small>
              </span>
            </label>
          </section>

          <section className="adm-card" onFocus={() => setFocus('summary')}>
            <div className="adm-cv-h">
              <h3>Summary</h3>
              <button
                type="button"
                className="adm-link"
                onClick={() => {
                  set((c) => void (c.summary = DEFAULT_CV.summary));
                  toast('Summary reset to the original');
                }}
              >
                <Ic n="reset" />
                Reset
              </button>
            </div>
            <textarea
              className="adm-cv-summary"
              rows={7}
              maxLength={1500}
              value={cv.summary}
              aria-label="CV summary"
              onChange={(e) => set((c) => void (c.summary = e.target.value))}
            />
            <div className="adm-cv-meter" aria-live="polite">
              <span
                className="adm-cv-meterbar"
                style={{ '--v': Math.min(1, summaryLen / 1000) } as React.CSSProperties}
                data-state={summaryLen < 250 ? 'short' : summaryLen > 900 ? 'long' : 'ok'}
              />
              <small>
                {summaryLen} characters.{' '}
                {summaryLen < 250
                  ? 'A little short: add your focus and your stack.'
                  : summaryLen > 900
                    ? 'Long: recruiters skim, so aim for 400 to 800.'
                    : 'A good length.'}
              </small>
            </div>
          </section>

          <section className="adm-card">
            <h3>Sections</h3>
            <p className="adm-muted">
              Drag to reorder, rename a section, or switch it off. Point at one to find it in the preview.
            </p>
            <ol className="adm-cvsecs">
              {cv.sections.map((s, i) => (
                <li
                  key={s.key}
                  className={[drag === i ? 'drag' : '', s.visible ? '' : 'off', focus === s.key ? 'on' : '']
                    .join(' ')
                    .trim()}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, i)}
                  onDragEnd={() => setDrag(null)}
                  onMouseEnter={() => setFocus(s.key)}
                  onFocus={() => setFocus(s.key)}
                >
                  <span className="adm-grip" aria-hidden="true">
                    <Ic n="grip" />
                  </span>
                  <span className="adm-cvsec-main">
                    <input
                      value={s.title}
                      maxLength={40}
                      placeholder={CV_SECTION_TITLES[s.key]}
                      aria-label={`Title of the ${CV_SECTION_TITLES[s.key]} section`}
                      onChange={(e) => set((c) => void (c.sections[i].title = e.target.value))}
                    />
                    <small>{n[s.key]}</small>
                  </span>
                  <span className="adm-cvsec-act">
                    <button
                      type="button"
                      className="adm-ibtn"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      <Ic n="up" />
                    </button>
                    <button
                      type="button"
                      className="adm-ibtn"
                      aria-label="Move down"
                      disabled={i === cv.sections.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      <Ic n="down" />
                    </button>
                    <Switch
                      on={s.visible}
                      label={`Show the ${s.title || CV_SECTION_TITLES[s.key]} section`}
                      set={(v) => set((c) => void (c.sections[i].visible = v))}
                    />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="adm-card" onMouseEnter={() => setFocus('projects')}>
            <h3>Projects on the CV</h3>
            <div className="adm-seg" role="tablist" aria-label="How projects are described">
              {(
                [
                  ['summary', 'Summary'],
                  ['features', 'Key features'],
                  ['both', 'Both'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={cv.projectStyle === k}
                  onClick={() => set((c) => void (c.projectStyle = k))}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="adm-muted">
              How each project is described, unless it has its own CV bullets. New projects are included automatically.
            </p>
            <ul className="adm-cvitems">
              {projects.map((p) => (
                <li key={p.id} className={p.cv ? '' : 'off'}>
                  <Switch
                    on={p.cv}
                    label={`Include ${p.title} on the CV`}
                    set={(v) => update((x) => void (x.projects.find((y) => y.id === p.id)!.cv = v))}
                  />
                  <span>
                    <b>{p.title}</b>
                    <small>
                      {p.cvBullets.filter(Boolean).length
                        ? `${p.cvBullets.filter(Boolean).length} CV bullet${p.cvBullets.filter(Boolean).length > 1 ? 's' : ''} of its own`
                        : 'Uses the style above'}
                    </small>
                  </span>
                  <button type="button" className="adm-link" onClick={() => open(projectSpec(p, ctx))}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="adm-card" onMouseEnter={() => setFocus('experience')}>
            <h3>Roles on the CV</h3>
            <p className="adm-muted">
              Each role's bullets from the Experience tab are used. New roles are included automatically.
            </p>
            <ul className="adm-cvitems">
              {roles.map((r) => (
                <li key={r.id} className={r.cv ? '' : 'off'}>
                  <Switch
                    on={r.cv}
                    label={`Include ${r.title} on the CV`}
                    set={(v) => update((x) => void (x.experience.find((y) => y.id === r.id)!.cv = v))}
                  />
                  <span>
                    <b>{r.title}</b>
                    <small>
                      {r.org}, {r.bullets.filter(Boolean).length} bullet
                      {r.bullets.filter(Boolean).length === 1 ? '' : 's'}
                    </small>
                  </span>
                  <button type="button" className="adm-link" onClick={() => open(roleSpec(r, false, ctx))}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Preview d={d} focus={focus} />
      </div>
    </>
  );
}

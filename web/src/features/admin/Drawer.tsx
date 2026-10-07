import { useEffect, useRef, useState } from 'react';
import { FieldView, normalize, validateField } from './fields';
import { Ic, useUi } from './ui';
import type { DrawerSpec, Obj } from './studio-state';

const ids = new WeakMap<DrawerSpec, number>();
let nextId = 1;

/** Side panel for adding or editing one item, with a live preview and validation. */
export function Drawer({ spec, close }: { spec: DrawerSpec | null; close: () => void }) {
  if (spec && !ids.has(spec)) ids.set(spec, nextId++);
  return (
    <div className={`adm-drawer${spec ? ' on' : ''}`} aria-hidden={!spec}>
      {spec ? <Panel key={ids.get(spec)} spec={spec} close={close} /> : <div className="adm-dpanel" />}
    </div>
  );
}

function Panel({ spec, close }: { spec: DrawerSpec; close: () => void }) {
  const { ask } = useUi();
  const [cur, setCur] = useState<Obj>(spec.cur);
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const orig = useRef(JSON.stringify(spec.cur));
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('adm-noscroll');
    const t = setTimeout(() => bodyRef.current?.querySelector<HTMLElement>('input,textarea,select')?.focus(), 60);
    return () => {
      clearTimeout(t);
      document.body.classList.remove('adm-noscroll');
    };
  }, [spec]);

  const tryClose = async () => {
    if (
      JSON.stringify(cur) !== orig.current &&
      !(await ask({
        title: 'Close without saving?',
        text: 'Your edits in this panel will be lost.',
        ok: 'Close',
        cancel: 'Keep editing',
        danger: true,
      }))
    )
      return;
    close();
  };

  const save = () => {
    const fields = spec.fields(cur);
    const next: Record<string, string | null> = {};
    let firstBad: string | null = null;
    for (const f of fields) {
      if (!('key' in f)) continue;
      const e = validateField(f, cur);
      next[f.key] = e;
      if (e && !firstBad) firstBad = f.key;
    }
    setErrs(next);
    if (firstBad) {
      setTimeout(() => {
        const el = bodyRef.current?.querySelector('.adm-field.bad');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.querySelector<HTMLElement>('input,textarea,select')?.focus();
      }, 0);
      return;
    }
    spec.onSave(normalize(fields, cur));
    close();
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (document.querySelector('.adm-modal')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        void tryClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const set = (key: string, v: unknown) =>
    setCur((c) => {
      const n = { ...c, [key]: v };
      return spec.onChange ? spec.onChange(n, key) : n;
    });

  return (
    <>
      <div className="adm-dback" onClick={() => void tryClose()} />
      <div className="adm-dpanel" role="dialog" aria-modal="true" aria-labelledby="admDt">
        <header>
          <h3 id="admDt">{spec.title}</h3>
          <button type="button" className="adm-ibtn" aria-label="Close" onClick={() => void tryClose()}>
            <Ic n="x" />
          </button>
        </header>
        <div className="adm-dbody" ref={bodyRef}>
          {spec.preview && <div className="adm-pv">{spec.preview(cur)}</div>}
          {spec.fields(cur).map((f, i) => (
            <FieldView
              key={'key' in f ? f.key : `${f.kind}-${i}`}
              f={f}
              o={cur}
              set={set}
              err={'key' in f ? errs[f.key] : null}
              setErr={(k, e) => setErrs((x) => ({ ...x, [k]: e }))}
            />
          ))}
        </div>
        <footer>
          <span className="adm-dhint">Ctrl + S to save</span>
          <button type="button" className="adm-btn ghost" onClick={() => void tryClose()}>
            Cancel
          </button>
          <button type="button" className="adm-btn primary" onClick={save}>
            Save
          </button>
        </footer>
      </div>
    </>
  );
}

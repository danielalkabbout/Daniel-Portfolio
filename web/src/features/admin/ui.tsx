import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/* Shared studio UI: toast, confirm dialog and icons. */

const I = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: d }}
  />
);

const P = {
  overview:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  requests: '<path d="M4 4h16v12H5.2L4 17.2z"/><path d="M8 9h8M8 12h5"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  experience:
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  skills: '<path d="M12 2l2.4 5 5.6.8-4 3.9.9 5.5L12 14.6 7.1 17.2 8 11.7 4 7.8 9.6 7z"/>',
  services: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  about: '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  data: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  del: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:
    '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  cv: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  text: '<path d="M4 6V4h16v2M9 20h6M12 4v16"/>',
  warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  rocket:
    '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 4.5c3-1.5 5.5-1.5 5.5-1.5s0 2.5-1.5 5.5L12 15l-3-3z"/><path d="M9 12l-3-1 3-4h4M12 15l1 3 4-3v-4"/>',
} as const;

export type IconName = keyof typeof P;
export const Ic = ({ n }: { n: IconName }) => <I d={P[n]} />;

interface ModalOpts {
  title: string;
  text?: string;
  body?: ReactNode;
  ok?: string;
  cancel?: string;
  danger?: boolean;
}

interface Ui {
  toast: (msg: string, kind?: 'err' | '') => void;
  ask: (o: ModalOpts) => Promise<boolean>;
}

const UiCtx = createContext<Ui>({ toast: () => {}, ask: async () => false });
export const useUi = () => useContext(UiCtx);

function Modal({ o, done }: { o: ModalOpts; done: (v: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => okRef.current?.focus(), 30);
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(false);
      }
    };
    document.addEventListener('keydown', k, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', k, true);
      prev?.focus?.();
    };
  }, [done]);
  return (
    <div className="adm-modal" onClick={(e) => e.target === e.currentTarget && done(false)}>
      <div className="adm-mbox" role="dialog" aria-modal="true" aria-labelledby="admMt">
        <h3 id="admMt">{o.title}</h3>
        <div className="adm-mbody">{o.body ?? <p>{o.text}</p>}</div>
        <div className="adm-mact">
          <button type="button" className="adm-btn ghost" onClick={() => done(false)}>
            {o.cancel ?? 'Cancel'}
          </button>
          <button
            type="button"
            ref={okRef}
            className={o.danger ? 'adm-btn danger' : 'adm-btn primary'}
            onClick={() => done(true)}
          >
            {o.ok ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: string; show: boolean }>({ msg: '', kind: '', show: false });
  const [modal, setModal] = useState<{ o: ModalOpts; res: (v: boolean) => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((msg: string, kind: 'err' | '' = '') => {
    setToast({ msg, kind, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }, []);
  const ask = useCallback((o: ModalOpts) => new Promise<boolean>((res) => setModal({ o, res })), []);
  const done = useCallback((v: boolean) => {
    setModal((m) => {
      m?.res(v);
      return null;
    });
  }, []);

  return (
    <UiCtx.Provider value={{ toast: say, ask }}>
      {children}
      <div className={`adm-toast${toast.show ? ' show' : ''} ${toast.kind}`} role="status" aria-live="polite">
        {toast.kind !== 'err' && <Ic n="check" />}
        <span>{toast.msg}</span>
      </div>
      {modal && <Modal o={modal.o} done={done} />}
    </UiCtx.Provider>
  );
}

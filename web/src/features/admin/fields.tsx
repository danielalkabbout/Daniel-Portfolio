import { useId, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../../api/client';
import { Ic, useUi } from './ui';

/* Form fields used by the studio's edit drawer and inline forms. */

type Obj = Record<string, unknown>;

export type Field =
  | { kind: 'section'; label: string }
  | { kind: 'note'; body: ReactNode }
  | {
      kind: 'text';
      key: string;
      label: string;
      req?: boolean;
      max?: number;
      ph?: string;
      help?: ReactNode;
      area?: boolean;
      rows?: number;
      url?: boolean;
      email?: boolean;
      digits?: boolean;
    }
  | { kind: 'select'; key: string; label: string; choices: [string, string][]; help?: ReactNode }
  | { kind: 'toggle'; key: string; label: string; help?: string }
  | { kind: 'chips'; key: string; label: string; req?: boolean; ph?: string; help?: ReactNode }
  | { kind: 'lines'; key: string; label: string; req?: boolean; ph?: string; addLabel?: string; help?: ReactNode }
  | { kind: 'metrics'; key: string; label: string }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'month'; key: string; label: string; req?: boolean; after?: string; hidden?: boolean };

const str = (v: unknown) => (v == null ? '' : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

/** Returns an error message, or null when the value is fine. */
export function validateField(f: Field, o: Obj): string | null {
  if (!('key' in f)) return null;
  const v = o[f.key];
  switch (f.kind) {
    case 'text': {
      const s = str(v).trim();
      if (f.req && !s) return 'This field is required.';
      if (s && f.url && !/^https:\/\/\S+\.\S+/.test(s)) return 'Enter a full link starting with https://';
      if (s && f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Enter a valid email address.';
      if (s && f.digits && !/^\d{8,15}$/.test(s))
        return 'Digits only, with country code, no + or spaces. Example: 96171522745';
      return null;
    }
    case 'chips':
    case 'lines':
      return f.req && !arr(v).filter((x) => x.trim()).length ? 'Add at least one.' : null;
    case 'month':
      if (f.hidden) return null;
      if (f.req && !v) return 'Pick a month.';
      if (f.after && v && str(v) < f.after) return 'The end date is before the start date.';
      return null;
    default:
      return null;
  }
}

/** Trims text and drops empty list entries before saving. */
export function normalize(fields: Field[], o: Obj): Obj {
  const c: Obj = { ...o };
  for (const f of fields) {
    if (!('key' in f)) continue;
    if (f.kind === 'text') c[f.key] = str(c[f.key]).trim();
    if (f.kind === 'lines' || f.kind === 'chips')
      c[f.key] = arr(c[f.key])
        .map((x) => x.trim())
        .filter(Boolean);
    if (f.kind === 'metrics')
      c[f.key] = ((c[f.key] as string[][]) ?? [])
        .filter((m) => str(m[0]).trim() && str(m[1]).trim())
        .map((m) => [m[0].trim(), m[1].trim()]);
  }
  return c;
}

function Wrap({
  label,
  req,
  help,
  err,
  htmlFor,
  children,
  className,
}: {
  label: string;
  req?: boolean;
  help?: ReactNode;
  err?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`adm-field${err ? ' bad' : ''}${className ? ` ${className}` : ''}`} data-field>
      <label htmlFor={htmlFor}>
        {label} {req ? <i>*</i> : <em>optional</em>}
      </label>
      {children}
      {help && <small className="adm-help">{help}</small>}
      <small className="adm-err" role="alert">
        {err}
      </small>
    </div>
  );
}

function Chips({
  value,
  onChange,
  ph,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  ph?: string;
  id?: string;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const next = [...value];
    raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => {
        if (!next.some((y) => y.toLowerCase() === x.toLowerCase())) next.push(x);
      });
    onChange(next);
  };
  return (
    <div className="adm-chipin" onClick={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
      <div className="adm-chips">
        {value.map((t, i) => (
          <span key={`${t}-${i}`} className="adm-chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        id={id}
        ref={inputRef}
        placeholder={ph ?? 'Add and press Enter'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault();
            add(text);
            setText('');
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text');
          if (t.includes(',')) {
            e.preventDefault();
            add(t);
          }
        }}
        onBlur={() => {
          if (text.trim()) {
            add(text);
            setText('');
          }
        }}
      />
    </div>
  );
}

function Lines({
  value,
  onChange,
  ph,
  addLabel,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  ph?: string;
  addLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const move = (i: number, d: number) => {
    const a = [...value];
    a.splice(i + d, 0, a.splice(i, 1)[0]);
    onChange(a);
  };
  return (
    <>
      <div className="adm-lines" ref={box}>
        {value.map((t, i) => (
          <div className="adm-line" key={i}>
            <span className="adm-ln">{i + 1}</span>
            <textarea
              rows={2}
              placeholder={ph}
              value={t}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <div className="adm-lact">
              <button
                type="button"
                className="adm-ibtn sm"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <Ic n="up" />
              </button>
              <button
                type="button"
                className="adm-ibtn sm"
                aria-label="Move down"
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
              >
                <Ic n="down" />
              </button>
              <button
                type="button"
                className="adm-ibtn sm danger"
                aria-label="Remove line"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Ic n="x" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="adm-add"
        onClick={() => {
          onChange([...value, '']);
          setTimeout(() => {
            const ts = box.current?.querySelectorAll('textarea');
            ts?.[ts.length - 1]?.focus();
          }, 0);
        }}
      >
        <Ic n="plus" />
        {addLabel ?? 'Add line'}
      </button>
    </>
  );
}

function Metrics({ value, onChange }: { value: string[][]; onChange: (v: string[][]) => void }) {
  const set = (i: number, k: number, v: string) =>
    onChange(value.map((m, j) => (j === i ? (k === 0 ? [v, m[1]] : [m[0], v]) : m)));
  return (
    <>
      <div className="adm-metrics">
        {value.map((m, i) => (
          <div className="adm-metric" key={i}>
            <input
              placeholder="12"
              value={m[0]}
              maxLength={12}
              aria-label="Number"
              onChange={(e) => set(i, 0, e.target.value)}
            />
            <input
              placeholder="what it counts"
              value={m[1]}
              maxLength={60}
              aria-label="Label"
              onChange={(e) => set(i, 1, e.target.value)}
            />
            <button
              type="button"
              className="adm-ibtn sm danger"
              aria-label="Remove metric"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Ic n="x" />
            </button>
          </div>
        ))}
      </div>
      {value.length < 4 && (
        <button type="button" className="adm-add" onClick={() => onChange([...value, ['', '']])}>
          <Ic n="plus" />
          Add metric
        </button>
      )}
    </>
  );
}

/** Resizes an image in the browser and returns it as a compressed data URL. */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('read'));
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('decode'));
      im.onload = () => {
        const w = Math.min(1400, im.width);
        const h = Math.round((im.height * w) / im.width);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(im, 0, 0, w, h);
        let u = c.toDataURL('image/webp', 0.82);
        if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/jpeg', 0.82);
        resolve(u);
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  });
}

/** Screenshot upload: goes to image storage (R2) when configured, otherwise is embedded in the content. */
function ImageField({
  value,
  onChange,
  setErr,
}: {
  value: string;
  onChange: (v: string) => void;
  setErr: (e: string | null) => void;
}) {
  const { toast } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (f?: File) => {
    if (!f || !/^image\//.test(f.type)) return setErr('Please choose an image file.');
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api<{ url: string }>('/api/admin/media', { method: 'POST', body: fd, timeoutMs: 60000 });
      onChange(res.url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setErr(e.message);
      else {
        // No image storage yet (or it is down): keep the picture inside the content instead.
        try {
          const u = await toDataUrl(f);
          if (u.length > 2_000_000) setErr('That image is too large. Try a smaller crop.');
          else {
            onChange(u);
            if (u.length > 700_000) toast('That image is large. Consider a smaller crop to keep the site fast.', 'err');
          }
        } catch {
          setErr('That image could not be read.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const size = value.startsWith('data:') ? `${Math.round((value.length * 0.75) / 1024)} KB` : 'Hosted image';
  return (
    <div
      className={`adm-drop${over ? ' over' : ''}`}
      tabIndex={0}
      role="button"
      aria-label="Upload screenshot"
      onClick={(e) => {
        if ((e.target as Element).closest('[data-r]')) return;
        fileRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void load(e.dataTransfer.files[0]);
      }}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        ref={fileRef}
        onChange={(e) => {
          void load(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="adm-dropin">
        {busy ? (
          <b>Uploading…</b>
        ) : value ? (
          <>
            <img src={value} alt="" />
            <div className="adm-imgbar">
              <span>{size}</span>
              <button type="button" className="adm-btn ghost sm" data-r onClick={() => onChange('')}>
                Remove
              </button>
              <button type="button" className="adm-btn ghost sm">
                Replace
              </button>
            </div>
          </>
        ) : (
          <>
            <Ic n="img" />
            <b>Drop a screenshot here</b>
            <span>or click to browse</span>
          </>
        )}
      </div>
    </div>
  );
}

export function FieldView({
  f,
  o,
  set,
  err,
  setErr,
}: {
  f: Field;
  o: Obj;
  set: (key: string, v: unknown) => void;
  err?: string | null;
  setErr: (key: string, e: string | null) => void;
}) {
  const id = useId();
  if (f.kind === 'section') return <h4 className="adm-sect">{f.label}</h4>;
  if (f.kind === 'note') return <div className="adm-note">{f.body}</div>;
  const v = o[f.key];
  const change = (val: unknown) => {
    set(f.key, val);
    if (err) setErr(f.key, null);
  };
  switch (f.kind) {
    case 'text': {
      const val = str(v);
      const common = {
        id,
        value: val,
        placeholder: f.ph,
        maxLength: f.max,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(e.target.value),
      };
      return (
        <Wrap label={f.label} req={f.req} help={f.help} err={err} htmlFor={id}>
          <div className="adm-inwrap">
            {f.area ? <textarea rows={f.rows ?? 4} {...common} /> : <input {...common} />}
            {f.max && (
              <span className="adm-count">
                {val.length}/{f.max}
              </span>
            )}
          </div>
        </Wrap>
      );
    }
    case 'select':
      return (
        <Wrap label={f.label} help={f.help} err={err} htmlFor={id}>
          <select id={id} value={str(v)} onChange={(e) => change(e.target.value)}>
            {f.choices.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Wrap>
      );
    case 'toggle':
      return (
        <div className="adm-field adm-tog">
          <label className="adm-switch">
            <input type="checkbox" checked={v !== false} onChange={(e) => change(e.target.checked)} />
            <span className="adm-sw" />
            <span>
              <b>{f.label}</b>
              {f.help && <small>{f.help}</small>}
            </span>
          </label>
        </div>
      );
    case 'chips':
      return (
        <Wrap
          label={f.label}
          req={f.req}
          err={err}
          htmlFor={id}
          help={
            f.help ?? (
              <>
                Type and press <kbd>Enter</kbd> or comma to add. Click × to remove. Paste a comma-separated list to add
                many at once.
              </>
            )
          }
        >
          <Chips id={id} value={arr(v)} onChange={change} ph={f.ph} />
        </Wrap>
      );
    case 'lines':
      return (
        <Wrap label={f.label} req={f.req} help={f.help} err={err}>
          <Lines value={arr(v)} onChange={change} ph={f.ph} addLabel={f.addLabel} />
        </Wrap>
      );
    case 'metrics':
      return (
        <Wrap
          label={f.label}
          err={err}
          help={
            <>
              Big numbers shown on the card, up to 4. Example: <b>12</b> SPFx web parts.
            </>
          }
        >
          <Metrics value={(v as string[][]) ?? []} onChange={change} />
        </Wrap>
      );
    case 'image':
      return (
        <Wrap label={f.label} err={err} help="PNG, JPG or WebP, up to 5 MB.">
          <ImageField value={str(v)} onChange={change} setErr={(e) => setErr(f.key, e)} />
        </Wrap>
      );
    case 'month':
      if (f.hidden) return null;
      return (
        <Wrap label={f.label} req={f.req} err={err} htmlFor={id}>
          <input type="month" id={id} value={str(v)} onChange={(e) => change(e.target.value)} />
        </Wrap>
      );
  }
}

/** Standalone chip editor used inline (skills cards, clients). */
export function ChipsField({
  label,
  value,
  onChange,
  help,
  ph,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  help?: ReactNode;
  ph?: string;
}) {
  const id = useId();
  return (
    <Wrap
      label={label}
      htmlFor={id}
      className="inline"
      help={
        help ?? (
          <>
            Type and press <kbd>Enter</kbd> or comma to add. Click × to remove.
          </>
        )
      }
    >
      <Chips id={id} value={value} onChange={onChange} ph={ph} />
    </Wrap>
  );
}

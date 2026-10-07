import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { reduceMotion } from '../../lib/env';
import { PlayIcon } from '../../lib/icons';
import { ARCH_SVG, DB_CARD_INNER, DETECTOR_SVG, LDAP_SVG } from './art';

/** Calls back whenever the element enters or leaves the screen. */
function useOnView<T extends Element>(ref: React.RefObject<T | null>, fn: (visible: boolean) => void, once = false) {
  const cb = useRef(fn);
  useEffect(() => {
    cb.current = fn;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      cb.current(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          cb.current(e.isIntersecting);
          if (once && e.isIntersecting) io.disconnect();
        }),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once]);
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface WaMsg {
  o?: boolean;
  h: string;
  save?: boolean;
}

const SCRIPTS: Record<'assist' | 'book', WaMsg[]> = {
  assist: [
    { o: true, h: '<div class="wm-voice"><b></b><span></span><small>0:06</small></div>' },
    { h: 'Transcribed: "Schedule a meeting with the team tomorrow at 10."' },
    { h: 'Done. The meeting is on your Outlook Calendar for tomorrow at 10:00.' },
    { o: true, h: '<div class="wm-file"><em>PDF</em><span>Q3-report.pdf</span></div>Save this to SharePoint' },
    { h: 'Uploaded Q3-report.pdf to SharePoint.' },
    { o: true, h: 'What does the travel policy say about hotels?' },
    { h: 'I found it in Travel-Policy.docx on SharePoint. Want me to email you a summary?' },
  ],
  book: [
    { o: true, h: "Hi, I'd like to book an appointment" },
    {
      h: 'Hi! Which doctor would you like to see?<div class="wm-btns"><span>General practitioner</span><span>Dermatologist</span></div>',
    },
    { o: true, h: 'Dermatologist' },
    { h: 'Available slots this week:<div class="wm-btns"><span>Tue 10:00</span><span>Thu 16:00</span></div>' },
    { o: true, h: 'Thu 16:00' },
    { h: 'Booked for Thursday at 16:00 with the dermatologist.', save: true },
  ],
};

/** A WhatsApp-style phone that plays an example conversation while it is on screen. */
function WaChat({
  chat,
  avatar,
  name,
  onSaved,
}: {
  chat: 'assist' | 'book';
  avatar: string;
  name: string;
  onSaved?: (saved: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const state = useRef({ run: 0, visible: false, timer: 0 as unknown as ReturnType<typeof setTimeout> });

  useEffect(() => {
    const st = state.current;
    return () => {
      st.run++;
      clearTimeout(st.timer);
    };
  }, []);

  useOnView(ref, (v) => {
    const st = state.current;
    const body = bodyRef.current!;
    const sc = SCRIPTS[chat];
    const add = (m: WaMsg) => {
      const d = document.createElement('div');
      d.className = `wm-b${m.o ? ' out' : ''}`;
      d.innerHTML = `${m.h}<time>${hhmm()}${m.o ? '<i>✓✓</i>' : ''}</time>`;
      body.appendChild(d);
      while (body.scrollHeight > body.clientHeight + 2 && body.children.length > 1) body.removeChild(body.firstChild!);
    };
    const play = () => {
      const my = ++st.run;
      body.innerHTML = '<div class="wm-sys">Today</div>';
      onSaved?.(false);
      if (reduceMotion()) {
        sc.forEach(add);
        onSaved?.(true);
        return;
      }
      let i = 0;
      const next = () => {
        if (my !== st.run || !st.visible) return;
        if (i >= sc.length) {
          st.timer = setTimeout(() => st.visible && play(), 4500);
          return;
        }
        const m = sc[i++];
        if (m.o)
          st.timer = setTimeout(() => {
            if (my !== st.run) return;
            add(m);
            next();
          }, 900);
        else
          st.timer = setTimeout(() => {
            if (my !== st.run) return;
            const ty = document.createElement('div');
            ty.className = 'wm-typing';
            ty.innerHTML = '<i></i><i></i><i></i>';
            body.appendChild(ty);
            st.timer = setTimeout(() => {
              if (my !== st.run) return;
              ty.remove();
              add(m);
              if (m.save) setTimeout(() => onSaved?.(true), 500);
              next();
            }, 1100);
          }, 500);
      };
      next();
    };
    const was = st.visible;
    st.visible = v;
    if (v && !was) play();
    if (!v) {
      st.run++;
      clearTimeout(st.timer);
    }
  });

  return (
    <div className="wa" data-chat={chat} ref={ref}>
      <div className="wa-top">
        <span className="wa-av">{avatar}</span>
        <div>
          <b>{name}</b>
          <small>on WhatsApp</small>
        </div>
      </div>
      <div className="wa-body" ref={bodyRef} />
      <div className="wa-foot">
        <span>Message</span>
        <i />
      </div>
    </div>
  );
}

const ARCH_DEFAULT = 'Hover or tap a box to see what it does.';

/** Architecture diagram: hovering, focusing or tapping a box explains it. */
function ArchDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => {
    const svg = ref.current?.querySelector('svg.arch');
    if (!svg) return;
    const nodes = Array.from(svg.querySelectorAll<SVGGElement>('.n'));
    const pick = (g: SVGGElement | null) => {
      nodes.forEach((n) => n.classList.toggle('sel', n === g));
      svg.classList.toggle('focusing', !!g);
      setInfo(g ? (g.dataset.info ?? null) : null);
    };
    const offs = nodes.map((g) => {
      const on = () => pick(g);
      const key = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick(g);
        }
      };
      g.addEventListener('mouseenter', on);
      g.addEventListener('focus', on);
      g.addEventListener('click', on);
      g.addEventListener('keydown', key);
      return () => {
        g.removeEventListener('mouseenter', on);
        g.removeEventListener('focus', on);
        g.removeEventListener('click', on);
        g.removeEventListener('keydown', key);
      };
    });
    const leave = () => pick(null);
    svg.addEventListener('mouseleave', leave);
    return () => {
      offs.forEach((f) => f());
      svg.removeEventListener('mouseleave', leave);
    };
  }, []);
  return (
    <>
      <div ref={ref} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: ARCH_SVG }} />
      <figcaption id="archInfo" aria-live="polite" className={info ? 'on' : undefined}>
        {info ?? ARCH_DEFAULT}
      </figcaption>
    </>
  );
}

function WhatsappDemo() {
  const [view, setView] = useState<'chat' | 'arch'>('chat');
  return (
    <div className="pj-stage">
      <div className="seg" role="tablist" aria-label="View">
        {(
          [
            ['chat', 'In WhatsApp'],
            ['arch', 'Architecture'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className={clsx('pj-view', view === 'chat' && 'on')} data-v="chat">
        <WaChat chat="assist" avatar="M" name="Microsoft 365 assistant" />
        <p className="pj-note">Example conversation showing what the assistant can do.</p>
      </div>
      <figure className={clsx('pj-view visual', view === 'arch' && 'on')} data-v="arch" style={{ margin: 0 }}>
        <ArchDiagram />
      </figure>
    </div>
  );
}

const PIPE = [
  ['Noisy audio clip', 'speech with background noise'],
  ['Feature extraction', 'MFCC, mel spectrogram and chroma features'],
  ['CNN classifier', 'identifies the type of background noise'],
  ['Reference recordings', 'loaded for the detected noise types'],
  ['Spectral gating', 'noisereduce removes that noise profile'],
  ['Clean audio', 'ready for the call'],
];
const PIPE_LABELS = [
  'Reading the clip',
  'Extracting features',
  'Classifying the noise',
  'Loading reference noise',
  'Removing the noise',
  'Clean audio',
];

/** Noise pipeline: press run and watch the waveform get classified and cleaned. */
function NoiseDemo() {
  const pathRef = useRef<SVGPathElement>(null);
  const [step, setStep] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [label, setLabel] = useState('Noisy input');
  const [running, setRunning] = useState(false);
  const [ranOnce, setRanOnce] = useState(false);
  const noise = useRef<number[]>([]);
  const raf = useRef(0);

  const N = 200;
  if (!noise.current.length) {
    let seed = 7;
    for (let i = 0; i < N; i++) {
      seed = (seed * 16807) % 2147483647;
      noise.current.push((seed / 2147483647) * 2 - 1);
    }
  }
  const render = (amt: number, ph: number) => {
    const clean = (i: number) => {
      const x = i / N;
      const env = Math.max(0, Math.sin(x * Math.PI * 3.2 + 0.4)) * 0.9 + 0.1;
      return env * (Math.sin(i * 0.42 + ph) * 0.6 + Math.sin(i * 0.17 + ph * 0.6) * 0.4);
    };
    let d = '';
    for (let i = 0; i < N; i++) {
      const y = 45 - (clean(i) * 24 + noise.current[(i + Math.floor(ph * 9)) % N] * 18 * amt);
      d += `${i ? 'L' : 'M'}${((i * 400) / (N - 1)).toFixed(1)} ${y.toFixed(1)}`;
    }
    pathRef.current?.setAttribute('d', d);
  };

  useEffect(() => {
    render(1, 0);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    if (running) return;
    setRunning(true);
    setFinished(false);
    const t0 = performance.now();
    const per = reduceMotion() ? 0 : 700;
    const total = per * PIPE.length;
    const tick = (t: number) => {
      const el = t - t0;
      const idx = per ? Math.min(Math.floor(el / per), PIPE.length - 1) : PIPE.length - 1;
      setStep(idx);
      setLabel(PIPE_LABELS[idx]);
      const gateStart = per * 4;
      const amt = per ? Math.max(0, 1 - Math.max(0, el - gateStart) / (per * 1.2)) : 0;
      render(amt, el / 260);
      if (el < total + 400 && per) raf.current = requestAnimationFrame(tick);
      else {
        render(0, el / 260);
        setStep(PIPE.length);
        setFinished(true);
        setLabel('Clean audio');
        setRunning(false);
        setRanOnce(true);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div className="pj-stage">
      <figure className="visual" style={{ margin: 0 }}>
        <div className={clsx('wave', finished && 'clean')}>
          <svg viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
            <path ref={pathRef} id="wavePath" />
          </svg>
          <div className="wave-bar">
            <span>{label}</span>
            <button className="btn primary run" type="button" disabled={running} onClick={run}>
              <PlayIcon />
              <span>{ranOnce ? 'Run it again' : 'Run the pipeline'}</span>
            </button>
          </div>
        </div>
        <ol className="pipe" id="pipe">
          {PIPE.map(([b, s], k) => (
            <li key={b} className={clsx(k < step && 'done', k === step && 'on')}>
              <div>
                <b>{b}</b>
                <span>{s}</span>
              </div>
            </li>
          ))}
        </ol>
        <figcaption>Press run to watch the noise get classified and removed.</figcaption>
      </figure>
    </div>
  );
}

function BookingDemo() {
  const [saved, setSaved] = useState(false);
  return (
    <div className="pj-stage split">
      <div>
        <WaChat chat="book" avatar="C" name="Clinic bookings" onSaved={setSaved} />
        <p className="pj-note">Example conversation and data, for illustration.</p>
      </div>
      <div
        className={clsx('db-card', saved && 'saved')}
        id="dbCard"
        dangerouslySetInnerHTML={{ __html: DB_CARD_INNER }}
      />
    </div>
  );
}

/** Object detection illustration: boxes draw themselves around the fruit. */
function DetectorDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Upload a photo');
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(false);
  const started = useRef(false);

  const go = () => {
    const det = ref.current?.querySelector('svg.det');
    if (!det) return;
    det.classList.remove('go');
    void (det as unknown as HTMLElement).getBoundingClientRect();
    det.classList.add('scan');
    setStatus('Running YOLOv8s…');
    setBusy(true);
    setTimeout(
      () => {
        det.classList.remove('scan');
        det.classList.add('go');
        setStatus('Detected 2 apples and 1 banana');
        setBusy(false);
        setAgain(true);
      },
      reduceMotion() ? 0 : 900,
    );
  };

  useOnView(
    ref,
    (v) => {
      if (v && !started.current) {
        started.current = true;
        if (reduceMotion()) ref.current?.querySelector('svg.det')?.classList.add('go');
        else go();
      }
    },
    true,
  );

  return (
    <div className="pj-stage">
      <figure className="visual" style={{ margin: 0 }}>
        <div ref={ref} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: DETECTOR_SVG }} />
        <div className="det-bar">
          <span>{status}</span>
          <button className="btn primary run" type="button" disabled={busy} onClick={go}>
            <PlayIcon />
            <span>{again ? 'Run again' : 'Run detection'}</span>
          </button>
        </div>
        <figcaption>Illustration of the kind of output the app produces.</figcaption>
      </figure>
    </div>
  );
}

function LdapDemo() {
  return (
    <div className="pj-stage">
      <figure className="visual" style={{ margin: 0 }}>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: LDAP_SVG }} />
        <figcaption>Illustration of how the pieces connect.</figcaption>
      </figure>
    </div>
  );
}

const TERM = [
  '<span class="c"># create a task</span>\n',
  '<span class="m">POST</span> <span class="u">/api/tasks</span>\n',
  '{ <span class="k">"title"</span>: <span class="s">"Prepare demo"</span> }\n\n',
  '<span class="ok">201 Created</span>\n',
  '{ <span class="k">"id"</span>: 42, <span class="k">"title"</span>: <span class="s">"Prepare demo"</span>, <span class="k">"isCompleted"</span>: false }\n\n',
  '<span class="c"># mark it done</span>\n',
  '<span class="m">PUT</span> <span class="u">/api/tasks/42</span>\n',
  '{ <span class="k">"isCompleted"</span>: true }\n\n',
  '<span class="ok">200 OK</span>\n',
  '{ <span class="k">"id"</span>: 42, <span class="k">"title"</span>: <span class="s">"Prepare demo"</span>, <span class="k">"isCompleted"</span>: true }\n',
];

/** API client terminal that types out example requests while on screen. */
function TodoDemo() {
  const ref = useRef<HTMLPreElement>(null);
  const st = useRef({ run: 0, visible: false });
  useEffect(() => {
    const s = st.current;
    return () => {
      s.run++;
    };
  }, []);
  useOnView(ref, (v) => {
    const s = st.current;
    const out = ref.current!;
    const play = () => {
      const my = ++s.run;
      let i = 0;
      let acc = '';
      if (reduceMotion()) {
        out.innerHTML = TERM.join('');
        return;
      }
      const step = () => {
        if (my !== s.run || !s.visible) return;
        if (i >= TERM.length) {
          out.innerHTML = `${acc}<span class="cur"></span>`;
          setTimeout(() => my === s.run && s.visible && play(), 5000);
          return;
        }
        const chunk = TERM[i++];
        acc += chunk;
        out.innerHTML = `${acc}<span class="cur"></span>`;
        setTimeout(step, /201|200/.test(chunk) ? 700 : /POST|PUT/.test(chunk) ? 420 : 260);
      };
      step();
    };
    const was = s.visible;
    s.visible = v;
    if (v && !was) play();
    if (!v) s.run++;
  });
  return (
    <div className="pj-stage">
      <div className="term" id="term">
        <div className="term-top">
          <i />
          <i />
          <i />
          <span>api client</span>
        </div>
        <pre id="termOut" aria-live="off" ref={ref} />
      </div>
      <p className="pj-note">Example requests, for illustration.</p>
    </div>
  );
}

export const DEMOS: Record<string, () => ReactNode> = {
  whatsapp: () => <WhatsappDemo />,
  noise: () => <NoiseDemo />,
  booking: () => <BookingDemo />,
  detector: () => <DetectorDemo />,
  ldap: () => <LdapDemo />,
  todo: () => <TodoDemo />,
};

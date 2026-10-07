import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import avatar from '../../assets/echo-avatar.jpg';
import { api, API_URL } from '../../api/client';
import { useSite } from '../../api/content';
import { escapeHtml, finePointer, reduceMotion } from '../../lib/env';
import { EchoEngine, GREETING, START_CHIPS, type EchoAnswer } from './engine';

interface Msg {
  id: number;
  who: 'me' | 'bot' | 'typing';
  /** For "me": plain text. For "bot": the HTML shown so far. */
  body: string;
  rich?: string;
  time: string;
  tick?: 'sent' | 'delivered' | 'read';
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The phone-style chat with Echo on the home page. Rules answer instantly; the AI handles what they can't. */
export function EchoChat() {
  const site = useSite();
  const engine = useMemo(() => new EchoEngine(site), [site]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('online');
  const [text, setText] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const nextId = useRef(1);
  const history = useRef<Turn[]>([]);
  const lastIntent = useRef<string | null>(null);

  useEffect(() => {
    const t = threadRef.current;
    if (t) t.scrollTop = t.scrollHeight;
  }, [msgs]);

  const add = (m: Omit<Msg, 'id'>) => {
    const id = nextId.current++;
    setMsgs((list) => [...list, { ...m, id }]);
    return id;
  };
  const patch = (id: number, p: Partial<Msg>) => setMsgs((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const remove = (id: number) => setMsgs((list) => list.filter((m) => m.id !== id));

  /** Types the answer out a couple of words at a time, then shows any buttons or cards. */
  async function stream(html: string, my: number) {
    const cut = html.search(/<(div|a) class="(ccard|cb|prow|tlc)/);
    const head = cut > -1 ? html.slice(0, cut) : html;
    const rich = cut > -1 ? html.slice(cut) : '';
    const id = add({ who: 'bot', body: '', time: now() });
    if (reduceMotion()) {
      patch(id, { body: head, rich });
      return;
    }
    const parts = head.split(/(<[^>]+>|\s+)/).filter(Boolean);
    let i = 0;
    let acc = '';
    while (i < parts.length) {
      let n = 0;
      while (i < parts.length && n < 2) {
        acc += parts[i];
        if (!parts[i].startsWith('<') && /\S/.test(parts[i])) n++;
        i++;
      }
      if (my !== run.current) return;
      patch(id, { body: acc });
      await wait(28);
    }
    if (my === run.current && rich) patch(id, { rich });
  }

  async function askAi(question: string): Promise<string | null> {
    if (!API_URL) return null;
    try {
      const res = await api<{ answer: string }>('/api/echo', {
        method: 'POST',
        body: { question, history: history.current.slice(-12) },
        timeoutMs: 25000,
      });
      return res.answer?.trim() || null;
    } catch {
      return null;
    }
  }

  async function reply(res: EchoAnswer, question: string, my: number, plainForHistory?: string) {
    await stream(res.a, my);
    if (my !== run.current) return;
    history.current.push(
      { role: 'user', content: question.slice(0, 300) },
      {
        role: 'assistant',
        content: (plainForHistory ?? res.a.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 1500),
      },
    );
    history.current = history.current.slice(-12);
    if (res.id) lastIntent.current = res.id;
    setStatus('online');
    setChips(res.f.length ? res.f : ['Who is Daniel?', 'Can I hire him?']);
    setBusy(false);
    if (finePointer()) inputRef.current?.focus({ preventScroll: true });
  }

  async function send(raw: string, fromChip = false) {
    const q = raw.trim();
    if (!q || busy) return;
    const my = run.current;
    const reduce = reduceMotion();
    setBusy(true);
    setText('');
    setChips([]);
    const meId = add({ who: 'me', body: q, time: now(), tick: 'sent' });
    setTimeout(() => patch(meId, { tick: 'delivered' }), 350);
    if (fromChip && engine.isGitHubChip(q)) window.open(engine.github, '_blank', 'noopener');

    let res = fromChip ? engine.chip(q, lastIntent.current) : engine.answer(q, lastIntent.current);
    await wait(reduce ? 0 : 700);
    if (my !== run.current) return;
    patch(meId, { tick: 'read' });
    setStatus('typing…');
    const typingId = add({ who: 'typing', body: '', time: '' });

    let plain: string | undefined;
    if (res.unsure) {
      const ai = await askAi(q);
      if (my !== run.current) return;
      if (ai) {
        plain = ai;
        res = {
          a: escapeHtml(ai).replace(/\n+/g, '<br>'),
          f: ['Can I hire him?', 'His projects', 'How do I contact him?'],
        };
      }
    }
    if (!plain) {
      const len = res.a.replace(/<[^>]+>/g, '').length;
      await wait(reduce ? 0 : Math.min(500 + len * 9, 1700));
    }
    if (my !== run.current) return;
    remove(typingId);
    await reply(res, q, my, plain);
  }

  async function greet() {
    const my = ++run.current;
    history.current = [];
    lastIntent.current = null;
    setMsgs([]);
    setChips([]);
    setBusy(true);
    setStatus('typing…');
    const typingId = add({ who: 'typing', body: '', time: '' });
    await wait(reduceMotion() ? 0 : 900);
    if (my !== run.current) return;
    remove(typingId);
    await stream(GREETING, my);
    if (my !== run.current) return;
    setStatus('online');
    setChips(START_CHIPS);
    setBusy(false);
  }

  // Greet once. A content refresh from the API swaps the engine without restarting the chat.
  useEffect(() => {
    const runs = run;
    void greet();
    return () => {
      runs.current++;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <div className="phone" role="region" aria-label="Chat with Echo, Daniel's assistant">
      <div className="phone-top">
        <div className="av">
          <img src={avatar} alt="" width="40" height="40" />
        </div>
        <div className="who">
          <b>
            Echo <em className="echo-tag">Daniel's assistant</em>
          </b>
          <small className={clsx(status !== 'online' && 'typing')}>{status}</small>
        </div>
        <button
          className="ph-btn"
          type="button"
          aria-label="Restart the chat"
          title="Restart"
          onClick={() => !busy && void greet()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
      <div className="thread" ref={threadRef} aria-live="polite">
        {msgs.map((m) =>
          m.who === 'typing' ? (
            <div key={m.id} className="b bot typing-b">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : m.who === 'me' ? (
            <div key={m.id} className="b me">
              <span className="bt">{m.body}</span>
              <span className="meta">
                {m.time}
                <i className={clsx('tick', m.tick === 'read' && 'read')} aria-label={m.tick}>
                  {m.tick === 'sent' ? '✓' : '✓✓'}
                </i>
              </span>
            </div>
          ) : (
            <div key={m.id} className="b bot">
              <span className="bt">
                <span dangerouslySetInnerHTML={{ __html: m.body }} />
                {m.rich && <div className="rich" dangerouslySetInnerHTML={{ __html: m.rich }} />}
              </span>
              <span className="meta">{m.time}</span>
            </div>
          ),
        )}
      </div>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className="chip" disabled={busy} onClick={() => void send(c, true)}>
            {c}
          </button>
        ))}
      </div>
      <form className="composer" autoComplete="off" onSubmit={onSubmit}>
        <label htmlFor="chatIn" className="sr">
          Ask a question about Daniel
        </label>
        <input
          id="chatIn"
          ref={inputRef}
          maxLength={300}
          placeholder="Ask anything about Daniel…"
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" aria-label="Send" disabled={busy}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}

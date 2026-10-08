import { useEffect, useRef, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Page } from '../components/Page';
import { useSite } from '../api/content';
import { api, API_ENABLED, ApiError } from '../api/client';
import { clamp01, reduceMotion, smooth } from '../lib/env';
import { ArrowRight, ChatIcon, LinkedInIcon, MailIcon, SERVICE_VISUALS, visualKey } from '../lib/icons';
import { Turnstile, TURNSTILE_SITE_KEY } from '../features/services/Turnstile';
import me from '../assets/daniel-small.jpg';

const WHEN = ['As soon as possible', 'Within a month', 'In 1 to 3 months', 'Not sure yet'];
const STEPS = ['Services', 'Details', 'Contact'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CheckPlus = () => (
  <span className="tk" aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="pl" d="M12 5v14M5 12h14" />
      <path className="ck" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  </span>
);

type Errors = Partial<Record<'svc' | 'message' | 'name' | 'email' | 'form', string>>;

export default function ServicesPage() {
  const site = useSite();
  const p = site.profile;
  const services = site.services.filter((s) => s.visible !== false);
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState('Not sure yet');
  const [form, setForm] = useState({ message: '', name: '', email: '', company: '', website: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | 'api' | 'mail'>(null);
  const [token, setToken] = useState('');
  const [trayHidden, setTrayHidden] = useState(false);
  const reqRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLOListElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const toggle = (name: string) => {
    setPicked((list) => (list.includes(name) ? list.filter((x) => x !== name) : [...list, name]));
    setErrors((e) => ({ ...e, svc: undefined }));
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined, form: undefined }));
  };

  // Hide the floating tray once the request form is on screen.
  useEffect(() => {
    const el = reqRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => setTrayHidden(es[0].isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The "how we'd work together" line fills as you scroll.
  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    const lis = Array.from(flow.children) as HTMLElement[];
    const on = () => {
      const r = flow.getBoundingClientRect();
      const p = reduceMotion() ? 1 : clamp01((innerHeight * 0.75 - r.top) / (r.height + innerHeight * 0.25));
      flow.style.setProperty('--fp', p.toFixed(3));
      lis.forEach((li, i) => li.classList.toggle('lit', p >= i / 2 - 0.01));
    };
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  const scrollToForm = () => reqRef.current?.scrollIntoView({ behavior: smooth() });

  function mailto(sv: string) {
    const subject = `Service request: ${sv}${form.company.trim() ? ` (${form.company.trim()})` : ''}`;
    const body =
      `Name: ${form.name.trim()}\nEmail: ${form.email.trim()}` +
      (form.company.trim() ? `\nCompany: ${form.company.trim()}` : '') +
      `\nServices: ${sv}\nTimeline: ${when}\n\n${form.message.trim()}`;
    window.location.href = `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent('mail');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) {
      if (!picked.length) return setErrors({ svc: 'Pick at least one service.' });
      return setStep(1);
    }
    if (step === 1) {
      if (!form.message.trim()) {
        setErrors({ message: 'Describe what you need in a few lines.' });
        msgRef.current?.focus();
        return;
      }
      setStep(2);
      setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 0);
      return;
    }
    const er: Errors = {};
    if (!form.name.trim()) er.name = 'Enter your name.';
    if (!EMAIL_RE.test(form.email.trim())) er.email = 'Enter a valid email address, like name@company.com.';
    if (er.name || er.email) {
      setErrors(er);
      (er.name ? nameRef : emailRef).current?.focus();
      return;
    }
    const sv = picked.join(', ');
    if (!API_ENABLED) return mailto(sv);
    if (TURNSTILE_SITE_KEY && !token)
      return setErrors({ form: 'Please complete the quick check above, then send again.' });

    setSending(true);
    try {
      await api('/api/requests', {
        method: 'POST',
        timeoutMs: 60000,
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          services: picked,
          timeline: when,
          message: form.message.trim(),
          turnstileToken: token,
          website: form.website,
        },
      });
      setSent('api');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setErrors({ form: err.messages.join(' ') });
      else if (err instanceof ApiError && err.status === 429) setErrors({ form: err.message });
      else mailto(sv); // server unreachable: fall back to the email app so the request isn't lost
    } finally {
      setSending(false);
    }
  }

  const waText = encodeURIComponent(`Hi Daniel, I'd like to request: ${picked.join(', ')}. ${form.message.trim()}`);
  const done = sent !== null;

  return (
    <Page name="services" title="Services, Daniel Al Kabbout">
      <div className="page-hero svc-hero">
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="wrap">
          <p className="title-line">Services</p>
          <h1 tabIndex={-1}>
            Pick what you need.
            <br />
            <span className="grad">I'll build it.</span>
          </h1>
          <p>
            Tap the services you're interested in, then send one request. Every project starts with a conversation about
            what it should do, and what it should never do.
          </p>
          <div className="more">
            <a
              className="btn primary"
              href="#request"
              onClick={(e) => {
                e.preventDefault();
                scrollToForm();
              }}
            >
              Start a request
            </a>
            <a className="btn" href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener">
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <section className="bento-sec">
        <div className="wrap">
          <div className="bento" id="bento" role="group" aria-label="Choose services">
            {services.map((s) => {
              const k = visualKey(s.visual);
              const name = s.chip || s.title;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`bt-tile bt-${k}`}
                  aria-pressed={picked.includes(name)}
                  onClick={() => toggle(name)}
                  onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
                  }}
                >
                  <CheckPlus />
                  <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SERVICE_VISUALS[k] }} />
                  <span className="bt-txt">
                    <b>{s.title}</b>
                    <span>{s.desc}</span>
                    {s.proof && <small>{s.proof}</small>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="bento-hint">Tap any card to add it to your request.</p>
        </div>
      </section>

      <section className="flow-sec">
        <div className="wrap">
          <div className="head">
            <h2>How we'd work together</h2>
            <p>The same process I use with clients at SoftFlow.</p>
          </div>
          <ol className="flow" id="flow" ref={flowRef}>
            <li>
              <span className="fl-n">1</span>
              <h3>Scope</h3>
              <p>
                We meet and agree on what you need. For an AI agent: what data it can access, who uses it, and what it
                should not do.
              </p>
            </li>
            <li>
              <span className="fl-n">2</span>
              <h3>Build</h3>
              <p>I set the technical approach and build it, keeping you updated as it takes shape.</p>
            </li>
            <li>
              <span className="fl-n">3</span>
              <h3>Review and launch</h3>
              <p>Everything is reviewed before it goes out, then deployed where your team works.</p>
            </li>
          </ol>
        </div>
      </section>

      <section id="request" className="wz-sec" ref={reqRef}>
        <div className="wrap wz-grid">
          <div className="wz-side">
            <div className="req-me">
              <img src={me} alt="Daniel Al Kabbout" width="72" height="72" />
              <p>
                <b>Requests come straight to me.</b>
                <span>I read every one and reply personally.</span>
              </p>
            </div>
            <h2>Request a service</h2>
            <p>
              {API_ENABLED
                ? 'Three quick steps, and your request lands straight in my inbox. Prefer to talk directly?'
                : 'Three quick steps. When you send, your email app opens with everything filled in. Prefer to talk directly?'}
            </p>
            <div className="direct">
              <a href={`mailto:${p.email}`}>
                <MailIcon />
                <div>
                  {p.email}
                  <small>Email</small>
                </div>
              </a>
              <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noopener">
                <ChatIcon />
                <div>
                  {p.phone}
                  <small>WhatsApp</small>
                </div>
              </a>
              <a href={p.linkedin} target="_blank" rel="noopener">
                <LinkedInIcon />
                <div>
                  {p.linkedin.replace(/^https:\/\/(www\.)?/, '')}
                  <small>LinkedIn</small>
                </div>
              </a>
            </div>
          </div>
          <div className="wz" id="wz">
            <div className="wz-prog" aria-hidden="true">
              <i style={{ width: done ? '100%' : `${((step + 1) / 3) * 100}%` }} />
            </div>
            <ol className="wz-steps">
              {STEPS.map((s, i) => (
                <li key={s} className={clsx(!done && i === step && 'on', (done || i < step) && 'done')}>
                  {s}
                </li>
              ))}
            </ol>
            <form noValidate onSubmit={(e) => void submit(e)}>
              {/* Hidden from people; bots that fill every field give themselves away. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={set('website')}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
              <fieldset className={clsx('wz-step', !done && step === 0 && 'on')} data-step="0">
                <legend>What do you need?</legend>
                <p className="wz-sub">Pick one or more.</p>
                <div className="wz-chips">
                  {[...services.map((s) => s.chip || s.title), 'Something else'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="wz-chip"
                      aria-pressed={picked.includes(name)}
                      onClick={() => toggle(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <p className="err">{errors.svc}</p>
              </fieldset>
              <fieldset className={clsx('wz-step', !done && step === 1 && 'on')} data-step="1">
                <legend>Tell me about it</legend>
                <div className="field full" data-bad={errors.message ? '' : undefined}>
                  <label htmlFor="fMsg">What should it do?</label>
                  <textarea
                    id="fMsg"
                    name="message"
                    ref={msgRef}
                    maxLength={4000}
                    placeholder="A few lines about the problem, who will use it, and the systems involved."
                    value={form.message}
                    onChange={set('message')}
                  />
                  <span className="err">{errors.message}</span>
                </div>
                <p className="wz-lab">When do you need it?</p>
                <div className="wz-chips single">
                  {WHEN.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className="wz-chip"
                      aria-pressed={when === w}
                      onClick={() => setWhen(w)}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={clsx('wz-step', !done && step === 2 && 'on')} data-step="2">
                <legend>How can I reach you?</legend>
                <div className="field" data-bad={errors.name ? '' : undefined}>
                  <label htmlFor="fName">Your name</label>
                  <input
                    id="fName"
                    name="name"
                    autoComplete="name"
                    ref={nameRef}
                    maxLength={120}
                    value={form.name}
                    onChange={set('name')}
                  />
                  <span className="err">{errors.name}</span>
                </div>
                <div className="field" data-bad={errors.email ? '' : undefined}>
                  <label htmlFor="fEmail">Email</label>
                  <input
                    id="fEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    ref={emailRef}
                    maxLength={200}
                    value={form.email}
                    onChange={set('email')}
                  />
                  <span className="err">{errors.email}</span>
                </div>
                <div className="field full">
                  <label htmlFor="fCompany">
                    Company <em>(optional)</em>
                  </label>
                  <input
                    id="fCompany"
                    name="company"
                    autoComplete="organization"
                    maxLength={160}
                    value={form.company}
                    onChange={set('company')}
                  />
                  <span className="err" />
                </div>
                {API_ENABLED && step === 2 && !done && <Turnstile onToken={setToken} />}
                {errors.form && (
                  <p className="wz-err" role="alert">
                    {errors.form}
                  </p>
                )}
              </fieldset>
              {done && (
                <div className="wz-done">
                  <div className="ok-ic">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </div>
                  {sent === 'api' ? (
                    <>
                      <h3>Thanks, {form.name.trim()}. Your request is in.</h3>
                      <p>I'll read it and reply to {form.email.trim()} personally, usually within a day or two.</p>
                    </>
                  ) : (
                    <>
                      <h3>Almost there, {form.name.trim()}</h3>
                      <p>
                        Your email app should be open with the request filled in. Press send there and I'll get back to
                        you.
                      </p>
                      <a
                        className="btn primary"
                        href={`https://wa.me/${p.whatsapp}?text=${waText}`}
                        target="_blank"
                        rel="noopener"
                      >
                        Nothing opened? Send on WhatsApp
                      </a>
                    </>
                  )}
                </div>
              )}
              {!done && (
                <div className="wz-nav">
                  <button
                    type="button"
                    className="btn"
                    hidden={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    Back
                  </button>
                  <span className="wz-sum">{step > 0 && picked.length ? picked.join(', ') : ''}</span>
                  <button type="submit" className="btn primary" disabled={sending}>
                    {step === 2 ? (sending ? 'Sending…' : 'Send request') : 'Continue'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <div className="tray" aria-live="polite" hidden={!picked.length || trayHidden}>
        <span className="tray-n">{picked.length}</span>
        <span className="tray-t">{picked.join(', ')}</span>
        <button type="button" className="tray-go" onClick={scrollToForm}>
          Continue
          <ArrowRight sw={2.4} />
        </button>
      </div>
    </Page>
  );
}

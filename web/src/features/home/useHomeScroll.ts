import { useEffect, type RefObject } from 'react';
import { clamp01, reduceMotion } from '../../lib/env';

/** Progress (0..1) through a tall, sticky section. */
function pinProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const t = r.height - innerHeight;
  return t > 0 ? clamp01(-r.top / t) : 0;
}

/**
 * Scroll-driven effects on the home page: the hero fades out, manifesto words light up,
 * the agent story steps through, the project reel slides sideways and the marquee drifts.
 */
export function useHomeScroll(rootRef: RefObject<HTMLElement | null>, reelCount: number, layout = '') {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = <T extends Element = HTMLElement>(q: string) => root.querySelector<T & HTMLElement>(q);
    const $$ = (q: string) => Array.from(root.querySelectorAll<HTMLElement>(q));

    const words = $$('#maniText .w');
    const sp = $('#storyPin');
    const stage = $('#stage');
    const items = $$('#stList li');
    const plat = $('#stPlat');
    const reel = $('#reel');
    const track = $('#reelTrack');
    const rows = $$('.mrow');
    const hero = $('#hero');
    const mani = $('#mani');
    let lastStep = -1;

    if (reduceMotion()) {
      words.forEach((w) => w.classList.add('lit'));
      if (stage) {
        stage.dataset.step = '3';
        stage.classList.add('s2in');
        items.forEach((li) => li.classList.add('on'));
      }
      return;
    }

    const sizeReel = () => {
      if (!reel || !track) return;
      const extra = Math.max(0, track.scrollWidth - innerWidth);
      reel.style.height = `${innerHeight + extra}px`;
      reel.dataset.extra = String(extra);
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      if (hero) hero.style.setProperty('--hp', clamp01(scrollY / (hero.offsetHeight * 0.9)).toFixed(3));
      if (mani) {
        const p = pinProgress(mani);
        mani.style.setProperty('--mp', p.toFixed(3));
        const n = Math.round(clamp01(p * 1.15) * words.length);
        words.forEach((w, i) => w.classList.toggle('lit', i < n));
      }
      if (sp && stage) {
        const q = pinProgress(sp);
        const step = Math.min(3, Math.floor(q * 4.0001));
        stage.style.setProperty('--sp', q.toFixed(3));
        const local = clamp01(q * 4 - step);
        if (step === 1) {
          stage.style.setProperty('--scan', local.toFixed(3));
          stage.classList.toggle('s2in', local > 0.45);
        } else stage.classList.toggle('s2in', step > 1);
        if (step !== lastStep) {
          lastStep = step;
          stage.dataset.step = String(step);
          items.forEach((li, k) => {
            li.classList.toggle('on', k === step);
            li.classList.toggle('past', k < step);
          });
          if (plat) plat.textContent = step === 3 ? 'scope agreed with the client' : 'in Microsoft Teams';
        }
      }
      if (reel && track) {
        const e = Number(reel.dataset.extra) || 0;
        track.style.transform = `translate3d(${(-pinProgress(reel) * e).toFixed(1)}px,0,0)`;
      }
      rows.forEach((r) => {
        const half = r.scrollWidth / 2;
        const s = Number(r.dataset.speed);
        let x = (scrollY * s) % half;
        if (x > 0) x -= half;
        r.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      });
    };
    const req = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    const onResize = () => {
      sizeReel();
      req();
    };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', onResize);
    document.fonts?.ready.then(onResize);
    sizeReel();
    update();
    return () => {
      removeEventListener('scroll', req);
      removeEventListener('resize', onResize);
    };
  }, [rootRef, reelCount, layout]);
}

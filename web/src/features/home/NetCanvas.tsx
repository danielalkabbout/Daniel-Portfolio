import { useEffect, useRef, type RefObject } from 'react';
import { reduceMotion } from '../../lib/env';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
interface Packet {
  a: Node;
  b: Node;
  k: number;
  c: 'sky' | 'mint' | 'sun';
}

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** The moving network behind the hero: nodes drift, link up, react to the pointer and pass packets. */
export function NetCanvas({ hero }: { hero: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const host = hero.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !host || !ctx) return;
    const reduce = reduceMotion();
    let W = 0;
    let H = 0;
    let nodes: Node[] = [];
    let pk: Packet[] = [];
    const mouse = { x: -9999, y: -9999 };
    const cols = { sky: '', mint: '', sun: '', line: '' };
    let visible = true;
    let last = 0;
    let frame = 0;
    let raf = 0;
    let alive = true;

    const readCols = () => {
      cols.sky = css('--sky');
      cols.mint = css('--mint');
      cols.sun = css('--sun');
      cols.line = css('--muted');
    };
    const size = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(Math.round((W * H) / 15000), 95);
      nodes = [];
      for (let i = 0; i < n; i++)
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.6 + 1,
        });
      readCols();
    };
    const alpha = (c: string, a: number) => {
      ctx.globalAlpha = a;
      return c;
    };
    const draw = (t: number) => {
      frame++;
      if (frame % 90 === 0) readCols();
      ctx.clearRect(0, 0, W, H);
      const max = 132;
      for (const a of nodes) {
        if (!reduce) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > W) a.vx *= -1;
          if (a.y < 0 || a.y > H) a.vy *= -1;
        }
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 170 && !reduce) {
          a.x += (dx / d) * 0.35;
          a.y += (dy / d) * 0.35;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          let d = dx * dx + dy * dy;
          if (d < max * max) {
            d = Math.sqrt(d);
            ctx.strokeStyle = alpha(cols.sky, (1 - d / max) * 0.22);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 200) {
          ctx.strokeStyle = alpha(cols.mint, (1 - d / 200) * 0.55);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      for (const a of nodes) {
        ctx.fillStyle = alpha(cols.sky, 0.55);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, 6.283);
        ctx.fill();
      }
      if (!reduce && t - last > 320 && nodes.length > 2) {
        last = t;
        const s = nodes[(Math.random() * nodes.length) | 0];
        let best: Node | null = null;
        let bd = 1e9;
        for (const n of nodes) {
          if (n === s) continue;
          const q = (n.x - s.x) ** 2 + (n.y - s.y) ** 2;
          if (q < bd && q > 400) {
            bd = q;
            best = n;
          }
        }
        if (best && bd < max * max)
          pk.push({ a: s, b: best, k: 0, c: Math.random() < 0.5 ? 'mint' : Math.random() < 0.5 ? 'sun' : 'sky' });
      }
      pk = pk.filter((p) => {
        p.k += 0.022;
        if (p.k >= 1) return false;
        const x = p.a.x + (p.b.x - p.a.x) * p.k;
        const y = p.a.y + (p.b.y - p.a.y) * p.k;
        ctx.fillStyle = alpha(cols[p.c], 0.25);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = alpha(cols[p.c], 1);
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, 6.283);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
    };
    const loop = (t: number) => {
      if (!alive) return;
      if (visible && !document.hidden) draw(t || 0);
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
    });
    io.observe(host);
    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        size();
        if (reduce) draw(0);
      }, 150);
    };
    addEventListener('resize', onResize);
    // Redraw in the new colours when the theme changes.
    const mo = new MutationObserver(() => {
      readCols();
      if (reduce) draw(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    size();
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(rt);
      io.disconnect();
      mo.disconnect();
      removeEventListener('resize', onResize);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, [hero]);

  return <canvas ref={ref} id="net" aria-hidden="true" />;
}

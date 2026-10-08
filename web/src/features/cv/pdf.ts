import type { jsPDF as JsPDF } from 'jspdf';
import { CV_FILE, CV_NAME, SEP, type Cv, type Run } from './cv';

/**
 * Draws the CV as a real A4 PDF with selectable text (applicant tracking systems can read it),
 * in the layout of the Word CV: Calibri-compatible Carlito, centred header, ruled section titles.
 * jsPDF and the fonts load only when someone presses Download.
 */

// Sizes in points, taken from the Word document.
const PAGE = { w: 595.28, h: 841.89, top: 42.5, bottom: 42.5, side: 45 };
const BODY = 10.5;
const LINE = 1.22; // Calibri's single line spacing
const ASCENT = 0.86;
const SEP_GAP = '  ';
const FONT = 'Carlito';

async function fontBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

interface Word {
  t: string;
  b: boolean;
  href?: string;
  w: number;
  /** Width of the space after it. */
  sp: number;
  /** Stays on the same line as the word before it (the "|" separator). */
  glue?: boolean;
}

class Writer {
  y = PAGE.top;
  private doc: JsPDF;
  constructor(doc: JsPDF) {
    this.doc = doc;
  }

  private width(t: string, b: boolean, size: number) {
    this.doc.setFont(FONT, b ? 'bold' : 'normal').setFontSize(size);
    return this.doc.getTextWidth(t);
  }

  private words(runs: Run[], size: number): Word[] {
    const out: Word[] = [];
    for (const r of runs) {
      const b = Boolean(r.b);
      if (r === SEP) {
        // "  |  " in regular weight, kept on the line of the word before it.
        const gap = this.width(SEP_GAP, false, size);
        const last = out[out.length - 1];
        if (last) last.sp = gap;
        out.push({ t: '|', b: false, w: this.width('|', false, size), sp: gap, glue: true });
        continue;
      }
      const parts = r.t.split(/(\s+)/);
      for (let i = 0; i < parts.length; i += 2) {
        const t = parts[i];
        const gap = parts[i + 1] ?? '';
        if (!t) {
          if (gap && out.length) out[out.length - 1].sp = this.width(gap, b, size);
          continue;
        }
        out.push({ t, b, href: r.href, w: this.width(t, b, size), sp: gap ? this.width(gap, b, size) : 0 });
      }
    }
    return out;
  }

  /** Starts a new page when fewer than `need` points are left. */
  ensure(need: number) {
    if (this.y + need > PAGE.h - PAGE.bottom) {
      this.doc.addPage();
      this.y = PAGE.top;
    }
  }

  /** Writes runs wrapped to the width, left-aligned or centred. */
  para(runs: Run[], o: { size?: number; x?: number; center?: boolean; after?: number; bullet?: boolean } = {}) {
    const size = o.size ?? BODY;
    const x0 = PAGE.side + (o.x ?? 0);
    const maxW = PAGE.w - PAGE.side - x0;
    const lh = size * LINE;
    const words = this.words(runs, size);
    const lines: Word[][] = [];
    let cur: Word[] = [];
    let w = 0;
    for (const word of words) {
      const add = (cur.length ? cur[cur.length - 1].sp : 0) + word.w;
      if (cur.length && w + add > maxW && !word.glue) {
        lines.push(cur);
        cur = [word];
        w = word.w;
      } else {
        cur.push(word);
        w += add;
      }
    }
    if (cur.length) lines.push(cur);

    lines.forEach((line, i) => {
      this.ensure(lh);
      const lineW = line.reduce((a, wd, j) => a + wd.w + (j < line.length - 1 ? wd.sp : 0), 0);
      let x = o.center ? (PAGE.w - lineW) / 2 : x0;
      const base = this.y + size * ASCENT;
      if (o.bullet && i === 0) {
        this.doc.setFont(FONT, 'normal').setFontSize(size);
        this.doc.text('•', x0 - 11, base);
      }
      line.forEach((wd, j) => {
        this.doc.setFont(FONT, wd.b ? 'bold' : 'normal').setFontSize(size);
        this.doc.text(wd.t, x, base);
        if (wd.href) this.doc.link(x, this.y, wd.w, lh, { url: wd.href });
        x += wd.w + (j < line.length - 1 ? wd.sp : 0);
      });
      this.y += lh;
    });
    this.y += o.after ?? 0;
  }

  heading(title: string) {
    const size = 11.5;
    this.y += 10;
    // Keep the title with at least two lines of what follows.
    this.ensure(size * LINE + 4 + BODY * LINE * 2);
    this.para([{ t: title, b: true }], { size });
    this.doc
      .setLineWidth(0.75)
      .setDrawColor(0)
      .line(PAGE.side, this.y + 1, PAGE.w - PAGE.side, this.y + 1);
    this.y += 5;
  }
}

/** Builds the PDF and starts the download. */
export async function downloadCvPdf(cv: Cv) {
  const [{ jsPDF }, regular, bold] = await Promise.all([
    import('jspdf'),
    fontBase64('/fonts/carlito-regular.ttf'),
    fontBase64('/fonts/carlito-bold.ttf'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('carlito-regular.ttf', regular);
  doc.addFont('carlito-regular.ttf', FONT, 'normal');
  doc.addFileToVFS('carlito-bold.ttf', bold);
  doc.addFont('carlito-bold.ttf', FONT, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setProperties({
    title: `${CV_NAME} - CV`,
    author: CV_NAME,
    subject: 'Curriculum vitae',
    keywords: 'AI Software Engineer, Backend Developer, .NET, Java, Python, Azure OpenAI',
    creator: CV_NAME,
  });

  const w = new Writer(doc);
  w.para([{ t: cv.name.toUpperCase(), b: true }], { size: 18, center: true, after: 1 });
  w.para(
    cv.headline.map((r) => (r === SEP ? r : { ...r, b: true })),
    { size: 11.5, center: true, after: 2 },
  );
  cv.contact.forEach((line, i) => w.para(line, { center: true, after: i === cv.contact.length - 1 ? 3 : 1 }));

  for (const s of cv.sections) {
    w.heading(s.title);
    s.lines?.forEach((l) => w.para(l, { after: s.title === 'Skills' ? 1.5 : 2 }));
    s.bullets?.forEach((b) => w.para(b, { x: 18, bullet: true, after: 1.5 }));
    s.entries?.forEach((e, i) => {
      if (i) w.y += 6;
      w.ensure(BODY * LINE * 2 + 2);
      w.para(e.head, { after: 2 });
      e.bullets.forEach((b) => w.para([{ t: b }], { x: 18, bullet: true, after: 1.5 }));
    });
  }

  doc.save(CV_FILE);
}

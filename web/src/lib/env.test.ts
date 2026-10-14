import { describe, expect, it } from 'vitest';
import { htmlToText } from './env';

describe('htmlToText', () => {
  it('keeps only the visible text', () => {
    expect(htmlToText('Hi <b>there</b><br>friend')).toBe('Hi there friend');
  });
  it('is not fooled by nested or broken tags', () => {
    const text = htmlToText('<scr<script>ipt>alert(1)</script>ok<img src=x onerror=alert(1)>');
    expect(text).not.toContain('<');
    expect(text).toContain('ok');
  });
});

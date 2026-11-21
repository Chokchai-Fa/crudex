import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchoolAnswer } from './answer';
import { presentRun } from './run-presentation';

function render(text: string) {
  return renderToStaticMarkup(<SchoolAnswer text={text} />);
}

describe('SchoolAnswer math', () => {
  it('renders Thai prose with inline equations and bare powers', () => {
    const html = render(String.raw`เฉลย 3^4 = 81 ค่ะ
\(3^4\) ไม่ใช่ 12 เพราะ \(3^4 = 3 × 3 × 3 × 3 = 81\) และ $2^3 = 8$`);
    expect(html.match(/<msup>/g)).toHaveLength(4);
    expect(html).toContain('เฉลย ');
    expect(html).toContain('ไม่ใช่ 12 เพราะ');
    expect(html).toContain('<mo>×</mo>');
  });

  it('renders both display delimiters, including multiline fractions', () => {
    const html = render(String.raw`\[
\frac{1}{2} + \frac{1}{2} = 1
\]
$$x^2 + y^2 = z^2$$`);
    expect(html.match(/display="block"/g)).toHaveLength(2);
    expect(html.match(/<mfrac>/g)).toHaveLength(2);
  });

  it('keeps links, inline code, and fenced code intact', () => {
    const html = render(
      'ดู [ฟอร์ม](https://forms.gle/demo) และ `3^4` หรือ ``3^4 + `code```\n' +
        '```txt\n$3^4$\nhttps://forms.gle/demo\n```\n' +
        'https://example.com/3^4  **คำตอบ 3^4**',
    );
    expect(html).toContain('href="https://forms.gle/demo"');
    expect(html).toContain('<code>3^4</code>');
    expect(html).toContain('<code>3^4 + `code`</code>');
    expect(html).toContain('<pre><code>$3^4$\nhttps://forms.gle/demo</code></pre>');
    expect(html).toContain('https://example.com/3^4');
    expect(html.match(/<msup>/g)).toHaveLength(1);
  });

  it('renders the same math from live or historical text deltas', () => {
    const events = [
      { type: 'delta', text: String.raw`ตอบ \(3^` },
      { type: 'delta', text: String.raw`4\) ค่ะ` },
    ] as const;
    expect(render(presentRun('running', [events[0]], false).answer)).not.toContain('<math');
    const live = render(presentRun('running', [...events], false).answer);
    const history = render(presentRun('succeeded', [...events], true).answer);
    expect(live).toContain('<msup>');
    expect(history).toBe(live);
  });

  it('keeps unsupported or malformed formulas readable', () => {
    const html = render(String.raw`ตัวอย่าง \(\notACommand{a}\) ค่ะ`);
    expect(html).toContain(String.raw`\(\notACommand{a}\)`);
    expect(html).not.toContain('<math');
  });
});

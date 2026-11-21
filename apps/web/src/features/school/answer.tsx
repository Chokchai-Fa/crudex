import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ReactNode } from 'react';

const googleResourceLabels = new Map([
  ['forms', 'เปิด Google Form'],
  ['presentation', 'เปิดสไลด์'],
  ['spreadsheets', 'เปิดชีต'],
  ['document', 'เปิดเอกสาร'],
]);

function resourceLink(href: string, key: number, label?: string) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
  let name: string | undefined;
  if (url.hostname === 'docs.google.com')
    name = googleResourceLabels.get(url.pathname.split('/')[1] ?? '');
  if (url.hostname === 'drive.google.com' && url.pathname.startsWith('/file/')) name = 'เปิดไฟล์';
  if (url.hostname === 'forms.gle') name = 'เปิด Google Form';
  if (url.hostname === 'create.kahoot.it') name = 'เปิด Kahoot';
  if (!name) return;
  return (
    <a
      key={key}
      href={url.href}
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {label || name}
    </a>
  );
}

function formula(source: string, fallback: string, key: number, displayMode = false) {
  try {
    const html = katex.renderToString(source.trim(), { displayMode, trust: false });
    return (
      <span
        key={key}
        className={displayMode ? 'block max-w-full overflow-x-auto' : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch (error) {
    if (!(error instanceof katex.ParseError)) throw error;
    return fallback;
  }
}

function barePowers(text: string, start: number) {
  // Only numeric powers are implicit, keeping identifiers and paths literal.
  const powers = /(?<![\w.^/])\d+(?:\.\d+)?\^(-?\d+)(?![\w^/]|\.\d)/g;
  const result: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(powers)) {
    const exponent = match[1]!;
    const base = match[0].slice(0, -exponent.length - 1);
    result.push(
      text.slice(offset, match.index),
      formula(base + '^{' + exponent + '}', match[0], start + match.index),
    );
    offset = match.index + match[0].length;
  }
  result.push(text.slice(offset));
  return result;
}

function inline(text: string) {
  const tokens =
    /(?<!`)(`+)(.+?)\1(?!`)|\[([^\][\n]+)\]\((https:\/\/[^\s<>()]+)\)|(https?:\/\/[^\s<>()[\]`"'\\]+)|\\\((.+?)\\\)|(?<![\w$\\])\$([^\s$](?:[^$]*?[^\s$])?)\$(?![\w$])|\*\*([^*\n]+)\*\*/g;
  const result: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    const [raw, , code, label, labeledHref, bareHref, parenMath, dollarMath, bold] = match;
    const at = match.index;
    result.push(...barePowers(text.slice(offset, at), offset));
    if (code !== undefined) {
      result.push(<code key={at}>{code}</code>);
    } else if (labeledHref || bareHref) {
      const href = labeledHref ?? bareHref!.replace(/[.,!?;:]+$/, '');
      const link = resourceLink(href, at, label);
      result.push(link ?? raw);
      if (link && bareHref) result.push(bareHref.slice(href.length));
    } else if (bold !== undefined) {
      result.push(<strong key={at}>{inline(bold)}</strong>);
    } else {
      result.push(formula(parenMath ?? dollarMath!, raw, at));
    }
    offset = at + raw.length;
  }
  result.push(...barePowers(text.slice(offset), offset));
  return result;
}

export function SchoolAnswer({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i++]!.trim();
    if (!line) continue;
    const fence = /^(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const marker = fence[1]!;
      const end = new RegExp('^' + marker[0] + '{' + marker.length + ',}\\s*$');
      const start = i;
      while (i < lines.length && !end.test(lines[i]!.trim())) i++;
      blocks.push(
        <pre key={start}>
          <code>{lines.slice(start, i).join('\n')}</code>
        </pre>,
      );
      if (i < lines.length) i++;
      continue;
    }
    const displayEnd = line.startsWith('\\[') ? '\\]' : line.startsWith('$$') ? '$$' : null;
    if (displayEnd) {
      const first = line.slice(2);
      let end = i - 1;
      if (!first.endsWith(displayEnd)) {
        end = lines.findIndex((next, index) => index >= i && next.trimEnd().endsWith(displayEnd));
      }
      if (end !== -1) {
        const display = [first, ...lines.slice(i, end + 1)].join('\n').trimEnd();
        const fallback = lines.slice(i - 1, end + 1).join('\n');
        blocks.push(<div key={i}>{formula(display.slice(0, -2), fallback, 0, true)}</div>);
        i = end + 1;
        continue;
      }
    }
    const heading = /^#{1,6}\s+(.+)/.exec(line);
    if (heading) {
      blocks.push(
        <h3 className="font-bold" key={i}>
          {inline(heading[1]!)}
        </h3>,
      );
      continue;
    }
    const list = /^([-*+]|\d+[.)])\s+(.+)/;
    const match = list.exec(line);
    if (match) {
      const ordered = /\d/.test(match[1]!);
      const items = [match[2]!];
      while (i < lines.length) {
        const next = list.exec(lines[i]!.trim());
        if (!next || /\d/.test(next[1]!) !== ordered) break;
        items.push(next[2]!);
        i++;
      }
      const children = items.map((item, n) => <li key={n}>{inline(item)}</li>);
      blocks.push(
        ordered ? (
          <ol key={i} start={parseInt(match[1]!, 10)}>
            {children}
          </ol>
        ) : (
          <ul key={i}>{children}</ul>
        ),
      );
    } else blocks.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="school-answer">{blocks}</div>;
}

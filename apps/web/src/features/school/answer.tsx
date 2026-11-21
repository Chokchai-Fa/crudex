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

function links(text: string) {
  const tokens = /\[([^\][\n]+)\]\((https:\/\/[^\s<>()]+)\)|(https:\/\/[^\s<>()[\]`"']+)/g;
  const result: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    const href = match[2] ?? match[3]!.replace(/[.,!?;:]+$/, '');
    const link = resourceLink(href, match.index, match[1]);
    if (!link) continue;
    result.push(text.slice(offset, match.index), link);
    offset = match.index + (match[2] ? match[0].length : href.length);
  }
  result.push(text.slice(offset));
  return result;
}

function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{links(part.slice(2, -2))}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return links(part);
  });
}

export function SchoolAnswer({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i++]!.trim();
    if (!line) continue;
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

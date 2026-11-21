import type { ReactNode } from 'react';

function inline(text: string) {
  return text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith('`') && part.endsWith('`') ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
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

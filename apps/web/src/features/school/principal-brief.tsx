// Presentation for the principal's morning brief (Paper 09). Reads the optional published
// brief and flagged classes from GET /api/briefs/morning; without them it shows the totals only.

export interface PublishedBrief {
  title: string;
  lines: string[];
}
export interface FlaggedClass {
  label: string;
  meanLabel?: string;
  meanPercent?: number;
  weakTopics: { topic: string; correctPercent?: number; correctLabel?: string }[];
}

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function splitBrief(raw: string): PublishedBrief | undefined {
  const [title, ...rest] = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return title ? { title, lines: rest } : undefined;
}

/** The single place that maps API field names to the card. */
export function readBriefExtras(data: unknown): {
  brief?: PublishedBrief;
  flagged?: FlaggedClass[];
} {
  if (!isObject(data)) return {};
  const nested = isObject(data.brief) ? data.brief : undefined;
  const title = text(nested?.title) ?? text(data.briefTitle);
  const lines = nested?.lines ?? data.briefLines ?? data.lines;
  let brief: PublishedBrief | undefined;
  if (title && Array.isArray(lines)) brief = { title, lines: lines.flatMap((l) => text(l) ?? []) };
  else brief = splitBrief(text(data.brief) ?? text(nested?.text) ?? text(data.briefText) ?? '');

  const rawFlagged = data.flaggedClasses;
  const details = Array.isArray(data.classes) ? data.classes.filter(isObject) : [];
  const flagged = Array.isArray(rawFlagged)
    ? rawFlagged.flatMap((item): FlaggedClass[] => {
        const c: Loose = isObject(item)
          ? item
          : (details.find((d) => d.label === item || d.name === item) ?? { label: item });
        const label = text(c.label) ?? text(c.name) ?? text(c.className);
        if (!label) return [];
        const topics = Array.isArray(c.weakTopics) ? c.weakTopics : [];
        return [
          {
            label,
            meanLabel: text(c.meanLabel),
            meanPercent: num(c.meanPercent) ?? num(c.averagePercent),
            weakTopics: topics.flatMap((t: unknown) =>
              isObject(t) && text(t.topic)
                ? [
                    {
                      topic: text(t.topic)!,
                      correctPercent: num(t.correctPercent),
                      correctLabel: text(t.correctLabel),
                    },
                  ]
                : typeof t === 'string'
                  ? [{ topic: t }]
                  : [],
            ),
          },
        ];
      })
    : undefined;
  return { brief, flagged };
}

export function BriefLines({ brief }: { brief: PublishedBrief }) {
  return (
    <ol className="brief-lines">
      {brief.lines.map((line, i) => (
        <li key={i}>
          <span aria-hidden="true">{i + 1}.</span> {line.replace(/^\d+[.)]\s*/, '')}
        </li>
      ))}
    </ol>
  );
}

export function WatchPanel({ flagged }: { flagged: FlaggedClass[] }) {
  return (
    <aside className="school-panel watch-panel space-y-3" aria-label="ห้องที่ควรดู">
      <div className="flex items-center gap-2">
        <h2 className="grow text-lg font-bold">ห้องที่ควรดู</h2>
        <span className="badge-sample">ข้อมูลตัวอย่าง</span>
      </div>
      {flagged.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีห้องหรือหัวข้อที่ต่ำกว่าเกณฑ์ 50%</p>
      ) : (
        <ul className="space-y-2.5">
          {flagged.map((c) => {
            const below = c.meanPercent !== undefined && c.meanPercent < 50;
            return (
              <li key={c.label} className="watch-class">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-[17px]">{c.label}</strong>
                  {below && <span className="badge-low">ต่ำกว่าเกณฑ์</span>}
                </div>
                {(c.meanLabel || c.meanPercent !== undefined) && (
                  <p className="watch-mean">
                    <span>ค่าเฉลี่ยห้อง</span>
                    <b>
                      {c.meanLabel}
                      {c.meanPercent !== undefined &&
                        (c.meanLabel ? ' (' + c.meanPercent + '%)' : c.meanPercent + '%')}
                    </b>
                  </p>
                )}
                {c.weakTopics.map((t) => (
                  <p key={t.topic} className="watch-topic">
                    <span>หัวข้อที่ควรทบทวน</span>
                    <b>
                      {t.topic}
                      {t.correctPercent !== undefined && ' · ถูก ' + t.correctPercent + '%'}
                    </b>
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

// Indices are one-based, as printed on the worksheet. Null means no submission.
const missedByRoom: Record<string, (number[] | null)[]> = {
  'ป.5/2': [
    [],
    [6],
    [3, 6],
    [3, 6, 8, 9, 10, 4],
    [2],
    [1, 3],
    [6],
    [],
    [1, 3, 4, 6, 7, 9],
    [3, 6, 10],
    [8],
    [2, 3, 4, 6, 7, 8, 9],
    [3],
    [6, 8],
    [1, 3, 4, 6, 9, 10],
    [],
    [6],
    [3, 6],
    null,
    null,
  ],
  'ป.5/1': [[3], [], [6, 9], [4, 6], null, null],
};

export function classroomResults(room: string) {
  return (missedByRoom[room] ?? []).map((missed, i) => ({
    number: i + 1,
    name: 'นักเรียนตัวอย่าง ' + (i + 1),
    missed,
    score: missed === null ? null : 10 - missed.length,
  }));
}

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeFile } from '../src/tools/make_file';
import { makeSlides } from '../src/tools/make_slides';

const context = { count: 1, signal: new AbortController().signal };
const request = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'bridge-fixture');
  vi.stubGlobal('fetch', request.mockReset());
});
afterEach(() => vi.unstubAllEnvs());

it('creates real slides through the bridge and returns its url', async () => {
  request.mockResolvedValueOnce(
    Response.json({
      ok: true,
      fileId: 'slidesFileId0001',
      url: 'https://docs.google.com/presentation/d/slidesFileId0001/edit',
    }),
  );
  const result = await makeSlides.execute(
    { title: 'พีทาโกรัส', slides: [{ title: 'นิยาม', bullets: ['a² + b² = c²'] }] },
    context,
  );
  expect(result).toMatchObject({
    mode: 'apps-script',
    url: 'https://docs.google.com/presentation/d/slidesFileId0001/edit',
    label: 'ข้อมูลตัวอย่าง',
    slideCount: 1,
  });
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
    action: 'createSlides',
    title: 'พีทาโกรัส',
    slides: [{ title: 'นิยาม', bullets: ['a² + b² = c²'] }],
  });
});

it('turns an outline into slide titles', async () => {
  request.mockResolvedValueOnce(
    Response.json({
      ok: true,
      fileId: 'slidesFileId0002',
      url: 'https://docs.google.com/presentation/d/slidesFileId0002/edit',
    }),
  );
  await makeSlides.execute({ title: 'ทบทวน', outline: ['หนึ่ง', 'สอง'] }, context);
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body)).slides).toEqual([
    { title: 'หนึ่ง', bullets: [] },
    { title: 'สอง', bullets: [] },
  ]);
});

it('creates a real PDF and rejects docx or missing sections without calling the bridge', async () => {
  request.mockResolvedValueOnce(
    Response.json({
      ok: true,
      fileId: 'pdfFileId000001',
      url: 'https://drive.google.com/file/d/pdfFileId000001/view',
    }),
  );
  expect(
    await makeFile.execute(
      { title: 'ใบงาน', format: 'pdf', sections: [{ heading: 'ข้อ 1', body: '3² + 4² = ?' }] },
      context,
    ),
  ).toMatchObject({
    mode: 'apps-script',
    kind: 'pdf',
    url: 'https://drive.google.com/file/d/pdfFileId000001/view',
  });
  await expect(makeFile.execute({ title: 'ใบงาน', format: 'docx' }, context)).rejects.toThrow();
  await expect(makeFile.execute({ title: 'ใบงาน', format: 'pdf' }, context)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});

it('never returns a fake id when the bridge fails or answers badly', async () => {
  request.mockResolvedValueOnce(new Response('nope', { status: 500 }));
  await expect(makeSlides.execute({ title: 't', outline: ['a'] }, context)).rejects.toThrow(
    'สร้างไฟล์ไม่สำเร็จ',
  );
  request.mockResolvedValueOnce(
    Response.json({ ok: true, fileId: 'x', url: 'https://evil.example/x' }),
  );
  await expect(makeSlides.execute({ title: 't', outline: ['a'] }, context)).rejects.toThrow(
    'สร้างไฟล์ไม่สำเร็จ',
  );
  request.mockRejectedValueOnce(new Error('network bridge-fixture'));
  await expect(
    makeFile.execute(
      { title: 't', format: 'pdf', sections: [{ heading: 'h', body: 'b' }] },
      context,
    ),
  ).rejects.toThrow('สร้างไฟล์ไม่สำเร็จ');
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', '');
  await expect(makeSlides.execute({ title: 't', outline: ['a'] }, context)).rejects.toThrow();
});

it('accepts rendered worksheet text as content', async () => {
  request.mockResolvedValueOnce(
    Response.json({
      ok: true,
      fileId: 'pdfFileId000002',
      url: 'https://drive.google.com/file/d/pdfFileId000002/view',
    }),
  );
  await makeFile.execute(
    { title: 'ใบงาน', format: 'pdf', content: '1) 3² + 4² = ?\nเฉลย: 25' },
    context,
  );
  expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
    action: 'createPdf',
    title: 'ใบงาน',
    sections: [
      { heading: 'ใบงาน', body: '1) 3² + 4² = ?' },
      { heading: 'เฉลย (สำหรับครู)', body: '25', pageBreakBefore: true },
    ],
  });
});

it('puts the answer key on its own last page', async () => {
  const ok = () =>
    Response.json({
      ok: true,
      fileId: 'pdfFileId000003',
      url: 'https://drive.google.com/file/d/pdfFileId000003/view',
    });
  const bodies = () =>
    request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).sections);
  request.mockImplementation(async () => ok());
  await makeFile.execute(
    { title: 'ใบงาน', format: 'pdf', content: '1. 3² + 4² = ?\nก. 25', answerKey: '1. ก' },
    context,
  );
  await makeFile.execute(
    { title: 'ใบงาน', format: 'pdf', content: '1. 3² + 4² = ?\nก. 25\n\nเฉลย: 1. ก' },
    context,
  );
  await makeFile.execute(
    {
      title: 'ใบงาน',
      format: 'pdf',
      sections: [
        { heading: 'เฉลย', body: '1. ก' },
        { heading: 'โจทย์', body: '1. 3² + 4² = ?' },
      ],
    },
    context,
  );
  const [explicit, split, ordered] = bodies();
  const key = { heading: 'เฉลย (สำหรับครู)', body: '1. ก', pageBreakBefore: true };
  expect(explicit).toEqual([{ heading: 'ใบงาน', body: '1. 3² + 4² = ?\nก. 25' }, key]);
  expect(split).toEqual([{ heading: 'ใบงาน', body: '1. 3² + 4² = ?\nก. 25' }, key]);
  expect(ordered).toEqual([
    { heading: 'โจทย์', body: '1. 3² + 4² = ?' },
    { heading: 'เฉลย', body: '1. ก', pageBreakBefore: true },
  ]);
  request.mockReset();
});

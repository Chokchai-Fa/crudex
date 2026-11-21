import { describe, expect, it } from 'vitest';
import { parseFollowUps } from './follow-ups';

describe('parseFollowUps', () => {
  it('splits a trailing block into chips', () => {
    const text =
      'ทำใบงานเสร็จแล้วค่ะ\n\nลองถามต่อ:\n- ทำเฉลยด้วย\n- ทำเป็น Google Form\n- ทำเกม Kahoot';
    expect(parseFollowUps(text)).toEqual({
      body: 'ทำใบงานเสร็จแล้วค่ะ',
      items: ['ทำเฉลยด้วย', 'ทำเป็น Google Form', 'ทำเกม Kahoot'],
    });
  });

  it('leaves a reply without the block untouched', () => {
    const text = 'สวัสดีค่ะคุณครู\n- ข้อแรก\n- ข้อสอง';
    expect(parseFollowUps(text)).toEqual({ body: text, items: [] });
  });

  it('accepts a block with only one item', () => {
    expect(parseFollowUps('เสร็จแล้วค่ะ\nลองถามต่อ:\n- สรุปคะแนนห้อง')).toEqual({
      body: 'เสร็จแล้วค่ะ',
      items: ['สรุปคะแนนห้อง'],
    });
  });

  it('tolerates extra spaces, blank lines and bold header', () => {
    const text = 'เสร็จแล้ว\n\n  **ลองถามต่อ :**  \n\n -   ทำ   สไลด์  \n\n- ทำเกม  \n\n';
    expect(parseFollowUps(text)).toEqual({ body: 'เสร็จแล้ว', items: ['ทำ สไลด์', 'ทำเกม'] });
  });

  it('ignores a malformed block and keeps at most 3 items', () => {
    expect(parseFollowUps('ก\nลองถามต่อ:\nไม่ใช่รายการ').items).toEqual([]);
    const many = 'ก\nลองถามต่อ:\n- 1\n- 2\n- 3\n- 4';
    expect(parseFollowUps(many).items).toEqual(['1', '2', '3']);
  });
});

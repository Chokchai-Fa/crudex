export interface InboxItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: number;
}

/** In-process stand-in for the test mailbox; the approval box lives in approval-store.ts. */
export const testMailbox: InboxItem[] = [];

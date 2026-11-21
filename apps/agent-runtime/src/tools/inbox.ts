export interface InboxItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: number;
}

/** In-process stand-ins for the principal's approval box and the test mailbox. */
export const approvalBox: InboxItem[] = [];
export const testMailbox: InboxItem[] = [];

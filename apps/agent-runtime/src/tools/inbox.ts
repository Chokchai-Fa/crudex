import { inbox } from '../state';

export type { InboxItem } from '../state';

/** The test mailbox; kept in the runtime state so it survives sandbox restarts. The approval box lives in approval-store.ts. */
export const testMailbox = inbox;

// ─── Customer ─────────────────────────────────────────────────────────────
// A Customer is a Contact whose customerType === 'Active Customer'.
// No separate DB model — this is a view/alias over Contact.

import type { Contact } from './contact.types';

export type Customer = Contact;

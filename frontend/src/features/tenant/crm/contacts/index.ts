// Contacts module — barrel export
export { default as ContactsPage } from './ui/contacts-page';

// UI components
export { ClientTable } from './ui/contacts-table';
export { ClientFilters } from './ui/contact-filters';
export { ContactFormSheet } from './ui/contact-form';
export { UnifiedDetailView } from './ui/contact-detail-view';
export { ClientDetailSheet } from './ui/contact-detail-sheet';

// Hooks
export { useContacts } from './hooks/use-contacts';

// Services
export { contactsService } from './services/contacts.service';

// Constants
export * from './constants/contact.constants';

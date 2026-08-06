'use client';
import dynamic from 'next/dynamic';
const ContactsPage = dynamic(() => import('../../../../src/features/tenant/crm/contacts/ui/contacts-page'), { ssr: false });
export default ContactsPage;

import { campaignTextLinkParts } from '@leadcrm/shared';

/** SMS stays plain text on send; links here model supported messaging applications. */
export function SmsMessageContent({ content }: { content: string }) {
  return <>{campaignTextLinkParts(content).map((part, index) => part.url
    ? <a key={index} href={part.url} target="_blank" rel="noopener noreferrer" className="underline [overflow-wrap:anywhere]" style={{ color: 'inherit' }}>{part.text}</a>
    : part.text)}</>;
}

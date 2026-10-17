'use client';

import { hasDefaultSmsFooter, insertDefaultSmsFooter, SMS_MAX_LENGTH } from '@leadcrm/shared';
import { Button } from './ui/button';

export function SmsFooterControl({ value, onChange, maxLength = SMS_MAX_LENGTH }: {
  value: string; onChange: (value: string) => void; maxLength?: number;
}) {
  const alreadyIncluded = hasDefaultSmsFooter(value);
  const tooLong = insertDefaultSmsFooter(value).length > maxLength;
  return <div className="flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" size="sm" disabled={alreadyIncluded || tooLong}
      title={alreadyIncluded ? 'The default footer is already in your message.' : tooLong ? 'The footer would exceed the message length limit.' : 'Add the default text at the end of your message.'}
      onClick={() => onChange(insertDefaultSmsFooter(value))}>Insert default SMS footer</Button>
    <p className="text-xs text-muted-foreground">Edit or remove the footer directly in the message. Your saved text is used when sending.</p>
  </div>;
}

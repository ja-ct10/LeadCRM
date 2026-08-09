import React from 'react';
import { Mail, UserCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { sanitizeEmailHtml } from '@/src/lib/sanitize';

interface EmailPreviewProps {
  subject: string;
  from?: string;
  to?: string;
  htmlContent: string;
  className?: string;
}

export function EmailPreview({ 
  subject, 
  from = 'youremail@gmail.com', 
  to = 'recipient@example.com',
  htmlContent,
  className 
}: EmailPreviewProps) {
  // Sanitize HTML content to prevent XSS
  const safeHtmlContent = sanitizeEmailHtml(htmlContent);

  return (
    <div className={cn('w-full max-w-2xl mx-auto flex flex-col bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg shadow-sm overflow-hidden', className)}>
      {/* Client Header */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center gap-2 border-b dark:border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-400 dark:bg-green-500/80"></div>
        </div>
        <div className="ml-4 text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Message Preview
        </div>
      </div>

      {/* Email Headers */}
      <div className="px-6 py-4 border-b dark:border-gray-800 space-y-3 bg-white dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          {subject || 'No Subject'}
        </h2>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <UserCircle2 className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {from.split('@')[0]} <span className="text-gray-500 dark:text-gray-400 font-normal">&lt;{from}&gt;</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                to {to}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="p-6 bg-white dark:bg-gray-900 min-h-75">
        {htmlContent ? (
          <div 
            className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200"
            dangerouslySetInnerHTML={{ __html: safeHtmlContent }} 
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
            Empty email body
          </div>
        )}
      </div>
    </div>
  );
}

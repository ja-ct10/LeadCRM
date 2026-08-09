/**
 * Basic HTML sanitization utility for email preview
 * Removes dangerous tags and attributes to prevent XSS
 * 
 * NOTE: This is a basic implementation. For production use,
 * install DOMPurify: npm install dompurify @types/dompurify
 */

const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_ATTRIBUTES = [
  'href', 'src', 'alt', 'title', 'width', 'height', 'style'
];

const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /on\w+\s*=/gi, // onload, onclick, etc.
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /<form[^>]*>.*?<\/form>/gi,
  /<input[^>]*>/gi,
  /<textarea[^>]*>.*?<\/textarea>/gi,
  /<select[^>]*>.*?<\/select>/gi,
  /<meta[^>]*>/gi,
  /<link[^>]*>/gi,
  /<base[^>]*>/gi,
];

/**
 * Basic HTML sanitization for email preview
 * Removes dangerous scripts, event handlers, and suspicious content
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let cleaned = html;

  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove data: URIs (potential XSS vector)
  cleaned = cleaned.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
  cleaned = cleaned.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');

  // Ensure external links open in new tab and have proper rel attributes
  cleaned = cleaned.replace(/<a\s+([^>]*?)href\s*=\s*["']https?:\/\/[^"']*["']([^>]*?)>/gi, 
    '<a $1href="$2" target="_blank" rel="noopener noreferrer">');

  // Remove any remaining javascript: URLs
  cleaned = cleaned.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  // Limit allowed style properties to safe ones
  cleaned = cleaned.replace(/style\s*=\s*["']([^"']*)["']/gi, (match, styles) => {
    const safeStyles = styles
      .split(';')
      .filter((style: string) => {
        const prop = style.trim().toLowerCase();
        return prop.startsWith('color:') || 
               prop.startsWith('background-color:') ||
               prop.startsWith('font-size:') ||
               prop.startsWith('font-weight:') ||
               prop.startsWith('text-align:') ||
               prop.startsWith('padding:') ||
               prop.startsWith('margin:') ||
               prop.startsWith('border:');
      })
      .join(';');
    return `style="${safeStyles}"`;
  });

  return cleaned;
}

/**
 * Sanitize and prepare HTML for safe rendering in email preview
 * Returns sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeEmailHtml(html: string): string {
  const sanitized = sanitizeHtml(html);
  
  // Add basic styling to ensure emails look reasonable
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">${sanitized}</div>`;
}
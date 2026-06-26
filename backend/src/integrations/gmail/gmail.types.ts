export interface GmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

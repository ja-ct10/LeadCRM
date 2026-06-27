export const mailConfig = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    redirectUri: process.env.GMAIL_REDIRECT_URI ?? '',
  },
} as const;

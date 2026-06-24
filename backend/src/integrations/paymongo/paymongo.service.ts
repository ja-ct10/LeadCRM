/**
 * PayMongo Integration Service
 * Handles subscription payments for LeadCRM plans.
 * All API keys sourced from environment variables — never hardcoded.
 */

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

function getAuthHeader(): string {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured');
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export async function createPaymentIntent(amountInCentavos: number, description: string) {
  const response = await fetch(`${PAYMONGO_BASE_URL}/payment_intents`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountInCentavos,
          payment_method_allowed: ['card', 'gcash', 'paymaya'],
          payment_method_options: { card: { request_three_d_secure: 'any' } },
          currency: 'PHP',
          description,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PayMongo error: ${response.statusText}`);
  }

  return response.json();
}

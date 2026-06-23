export interface PayMongoPaymentIntent {
  id: string;
  amount: number; // in centavos (PHP)
  currency: string;
  status: 'awaiting_payment_method' | 'awaiting_next_action' | 'processing' | 'succeeded' | 'cancelled';
  description?: string;
}

export interface PayMongoWebhookPayload {
  data: {
    id: string;
    type: string;
    attributes: {
      type: string;
      data: Record<string, unknown>;
      created_at: number;
      updated_at: number;
    };
  };
}

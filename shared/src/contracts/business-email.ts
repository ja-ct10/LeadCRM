export interface BusinessEmailStatus {
  email: string; connected: boolean; lastSyncAt: string | null; syncError: string | null;
}
export interface BusinessEmailInquiryRead {
  id: string; sender: string; senderName: string; subject: string; snippet: string;
  receivedAt: string; status: string; leadId: string | null;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  sequence: number;
  body: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  sequence: number;
  body: string;
  createdAt: string;
  delivery?: "sending" | "queued" | "failed";
  error?: string;
}
export interface ConversationSummary {
  matchId: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  peerReadSequence: number;
}
export interface ChatHistory {
  messages: ChatMessage[];
  nextBefore: number | null;
  peerReadSequence: number;
}

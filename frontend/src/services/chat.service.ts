import { api, API_ORIGIN } from "../config/api";
import { io } from "socket.io-client";
import { getSession } from "./session.service";
import type {
  ChatHistory,
  ChatMessage,
  ConversationSummary,
} from "../types/chat";

export const chatApi = {
  async conversations() {
    return (await api.get<ConversationSummary[]>("/chat/conversations")).data;
  },
  async history(matchId: string, before?: number) {
    return (
      await api.get<ChatHistory>(`/chat/${matchId}/messages`, {
        params: { before },
      })
    ).data;
  },
  async send(
    message: Pick<ChatMessage, "matchId" | "body" | "clientMessageId">,
  ) {
    return (
      await api.post<ChatMessage>(`/chat/${message.matchId}/messages`, message)
    ).data;
  },
  async read(matchId: string, messageId: string) {
    await api.post(`/chat/${matchId}/read`, { messageId });
  },
};
export function createChatSocket() {
  return io(API_ORIGIN, {
    autoConnect: false,
    transports: ["websocket"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: (done) => {
      void getSession()
        .then((session) => done({ token: session?.tokens.accessToken }))
        .catch(() => done({}));
    },
  });
}

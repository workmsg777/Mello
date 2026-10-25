import type { ChatMessage } from "../../types/chat";

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const result = new Map(
    current.map((message) => [message.clientMessageId, message]),
  );
  for (const message of incoming) {
    const existing = result.get(message.clientMessageId);
    // A delayed optimistic update must never replace an already committed message.
    if (!existing?.sequence || message.sequence)
      result.set(message.clientMessageId, message);
  }
  return [...result.values()].sort((a, b) => {
    if (a.sequence && b.sequence) return a.sequence - b.sequence;
    if (!!a.sequence !== !!b.sequence) return a.sequence ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** UUIDv4 from secure random bytes; also works on LAN HTTP browsers without randomUUID(). */
export function messageId(fillRandom: (bytes: Uint8Array) => Uint8Array) {
  const bytes = fillRandom(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

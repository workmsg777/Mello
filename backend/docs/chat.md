# Chat and conversation flow

Discover → both people like each other → match → chat. The match celebration opens **Say hello**. **Chats** is a primary navigation destination. **Plan a date** is a secondary action inside a conversation and keeps the existing invitation and partner-confirmation rules.

**Liked you** lists eligible people who sent a pending explicit like, with profile details, **Like back**, **Pass**, pagination and a navigation badge. One-sided likes never create conversations. Liking back creates the mutual match and opens the match celebration. The HTTP and WebSocket services verify both `USER` likes even when a match row already exists. Historical automatic demo likes are retained with source `DEMO`, excluded from incoming likes and consent checks. The demo seed no longer generates likes. Existing messages and match rows are preserved; stale rows cannot grant chat access.

## Storage and delivery

- PostgreSQL is the source of truth. `chat_messages` stores text, sender, match, server time, a per-match sequence and a client-generated UUID. Unique `(sender_id, client_message_id)` values make retries idempotent. Reusing an ID with different content returns 409.
- A sender row lock enforces a per-account 30-message/minute limit across HTTP and WebSockets. Updating the match row assigns a committed sequence shared by both participants. History uses keyset pagination, 50 messages per page.
- Socket.IO runs on the API HTTP server with WebSocket transport. The Redis adapter connects API instances using the `mello:chat` channel. Clients use the existing JWT and persisted session. The server assigns private user rooms; clients cannot subscribe to arbitrary conversations.
- Every operation validates JWT expiry, account status and session revocation. Receiving sessions are checked before private events are emitted; idle sockets are checked every 15 seconds. Only active mutual-match participants can send, fetch history, read or type. Partner accounts cannot access chat.
- Acknowledgements follow database commit. Broadcasts are best effort. Clients recover saved history on reconnect, foreground and periodic foreground catch-up, including missed pages. This covers a process failure after commit but before broadcast. Redis is not message storage and this is not an exactly-once network-delivery claim.
- The client deduplicates by client message ID, saves unsent messages in a per-user local outbox and drafts per conversation, and retries with the same ID. Unsent messages survive refresh/restart. Failed messages have a retry control. Typing expires after four seconds. Read pointers only advance and are updated for visible confirmed messages in the foreground conversation.

## HTTP API

All routes require a dating-user bearer token and completed onboarding.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/chat/conversations` | Last message, unread count and peer read sequence for up to 100 matches |
| GET | `/api/chat/:matchId/messages?before=123` | Latest 50 messages, or messages before the sequence; returns `messages`, `nextBefore`, `peerReadSequence` |
| POST | `/api/chat/:matchId/messages` | Idempotent send with `{clientMessageId,body}` |
| POST | `/api/chat/:matchId/read` | Advance read pointer up to the persisted `{messageId}` |

## WebSocket contract

Connect to the API origin with `socket.io-client`, `transports: ['websocket']` and `auth: {token: accessToken}`. Tokens are not query parameters. Client commands require an acknowledgement callback and receive `{ok:true,data}` or `{ok:false,error,status}`.

| Event | Direction | Payload |
| --- | --- | --- |
| `chat:send` | Client → server | `{matchId,clientMessageId,body}`; 1–2000 trimmed characters |
| `chat:message` | Server → both users' devices | `{id,matchId,senderId,clientMessageId,sequence,body,createdAt}` |
| `chat:read` | Client → server | `{matchId,messageId}` |
| `chat:read` | Server → both users' devices | `{matchId,userId,lastReadSequence}` |
| `chat:typing` | Client → server | `{matchId,typing}`; throttled |
| `chat:typing` | Server → peer's devices | `{matchId,userId,typing}` |
| `chat:matched` | Server → both users' devices | `{matchId}`; refresh matches to get authorized public profiles |
| `discovery:liked` | Server → recipient's devices | `{}`; refresh incoming likes from `/api/discovery/likes` |

## Running and validation

`docker compose up --build` applies the migration and exposes WebSockets on API port 4000. Existing matches work without backfilling: every match is a conversation, including those with zero messages. Multiple API instances must share the database, JWT configuration and private Redis deployment. Reverse proxies must pass WebSocket upgrades and keep connections open longer than the heartbeat interval. Production browsers need HTTPS/WSS. Redis must not be exposed to clients.

`npm test` uses isolated PostgreSQL and real WebSocket clients to check authorization, live delivery, typing, read receipts, reconnect history, retries, pagination and the send limit. The frontend supports web and Android bundles. `/preview` has a clearly labelled local-only chat design preview and does not fabricate replies from people.

This milestone implements one-to-one text chat. Attachments, push notifications, reporting/moderation, blocking/unmatching, deletion and end-to-end encryption are separate work; the message store is server-readable. Physical-device testing and multi-instance load testing are required before public release.

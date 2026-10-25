type Publish = (userIds: string[], event: string, payload: unknown) => void;
let publish: Publish | undefined;

export function registerChatPublisher(handler: Publish) {
  publish = handler;
  return () => {
    if (publish === handler) publish = undefined;
  };
}
export function publishChat(
  userIds: string[],
  event: string,
  payload: unknown,
) {
  publish?.(userIds, event, payload);
}

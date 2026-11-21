export function nextPlanStatus(
  current: string,
  action: string,
  isCreator: boolean,
): string | null {
  if (
    action === 'CANCELLED' &&
    (current === 'PROPOSED' || current === 'ACCEPTED')
  )
    return action;
  if (
    !isCreator &&
    current === 'PROPOSED' &&
    (action === 'ACCEPTED' || action === 'DECLINED')
  )
    return action;
  return null;
}

export function nextPhotoOrder(orders: number[]): number {
  return orders.length ? Math.max(...orders) + 1 : 0;
}

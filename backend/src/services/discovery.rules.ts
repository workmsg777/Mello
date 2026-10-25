import { createHash } from 'node:crypto';

/** UI placeholder only. Replace this boundary when the matching algorithm is defined. */
export function demoCompatibility(first: string, second: string): number {
  return (
    72 +
    (createHash('sha256')
      .update([first, second].sort().join(':'))
      .digest()
      .readUInt16BE(0) %
      27)
  );
}

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

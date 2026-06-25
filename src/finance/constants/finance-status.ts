import { PayableStatus, ReceivableStatus } from '@prisma/client';

/** 允许继续收款的应收状态 */
export const RECEIVABLE_RECEIPTABLE_STATUSES: ReceivableStatus[] = [
  ReceivableStatus.PENDING,
  ReceivableStatus.PARTIAL,
];

/** 允许继续付款的应付状态 */
export const PAYABLE_PAYABLE_STATUSES: PayableStatus[] = [
  PayableStatus.PENDING,
  PayableStatus.PARTIAL,
];

/** 允许作废的应收状态 */
export const RECEIVABLE_VOIDABLE_STATUSES: ReceivableStatus[] = [
  ReceivableStatus.PENDING,
  ReceivableStatus.PARTIAL,
];

/** 允许作废的应付状态 */
export const PAYABLE_VOIDABLE_STATUSES: PayableStatus[] = [
  PayableStatus.PENDING,
  PayableStatus.PARTIAL,
];

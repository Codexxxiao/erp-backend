import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  ReceivableStatus,
  FinanceReceivable,
  FinanceReceipt,
} from '@prisma/client';
import { ReceiptDto } from './dto/receipt.dto';
import {
  RECEIVABLE_RECEIPTABLE_STATUSES,
  RECEIVABLE_VOIDABLE_STATUSES,
} from './constants/finance-status';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private generateReceivableNo() {
    return `AR${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * 创建应收单（支持外部事务；同一订单仅一张有效应收）
   */
  async createReceivable(
    params: {
      orderId: number;
      orderNo: string;
      customerName: string;
      totalAmount: number;
      createdBy?: number;
      remark?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const executor = tx || this.prisma;

    const existing = await executor.financeReceivable.findFirst({
      where: {
        orderId: params.orderId,
        status: { not: ReceivableStatus.VOID },
      },
    });
    if (existing) {
      return existing;
    }

    const receivableNo = this.generateReceivableNo();

    return executor.financeReceivable.create({
      data: {
        receivableNo,
        orderId: params.orderId,
        orderNo: params.orderNo,
        customerName: params.customerName,
        totalAmount: params.totalAmount,
        createdBy: params.createdBy,
        remark: params.remark,
        status: ReceivableStatus.PENDING,
      },
    });
  }

  async findReceivableList(
    page = 1,
    pageSize = 10,
    status?: ReceivableStatus,
    keyword?: string,
  ) {
    const where: Prisma.FinanceReceivableWhereInput = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { receivableNo: { contains: keyword } },
        { orderNo: { contains: keyword } },
        { customerName: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.financeReceivable.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financeReceivable.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async findReceivableDetail(id: number) {
    const receivable = await this.prisma.financeReceivable.findUnique({
      where: { id },
      include: { order: true, receipts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!receivable) throw new NotFoundException('应收单不存在');
    return receivable;
  }

  /**
   * 收款核销：事务内状态机 + payNo 幂等 + 乐观锁更新
   */
  async receipt(id: number, dto: ReceiptDto, operator?: string) {
    await this.findReceivableDetail(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.financeReceivable.findUnique({ where: { id } });
      if (!fresh) throw new NotFoundException('应收单不存在');

      this.assertReceivableReceiptable(fresh);
      this.assertReceiptAmount(fresh, dto.amount);

      if (dto.payNo) {
        const existingReceipt = await tx.financeReceipt.findUnique({
          where: { payNo: dto.payNo },
        });
        if (existingReceipt) {
          this.assertReceiptIdempotent(existingReceipt, id, dto.amount);
          return tx.financeReceivable.findUniqueOrThrow({ where: { id } });
        }
      }

      try {
        await tx.financeReceipt.create({
          data: {
            receivableId: id,
            amount: dto.amount,
            payMethod: dto.payMethod,
            payNo: dto.payNo,
            operator,
            remark: dto.remark,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          dto.payNo
        ) {
          const existingReceipt = await tx.financeReceipt.findUnique({
            where: { payNo: dto.payNo },
          });
          if (existingReceipt) {
            this.assertReceiptIdempotent(existingReceipt, id, dto.amount);
            return tx.financeReceivable.findUniqueOrThrow({ where: { id } });
          }
        }
        throw error;
      }

      await this.applyReceivableReceipt(tx, fresh, dto.amount);
      return tx.financeReceivable.findUniqueOrThrow({ where: { id } });
    });

    return this.buildReceiptResponse(result);
  }

  async voidReceivable(id: number, reason: string, operator?: string) {
    await this.findReceivableDetail(id);

    const { count } = await this.prisma.financeReceivable.updateMany({
      where: {
        id,
        status: { in: RECEIVABLE_VOIDABLE_STATUSES },
      },
      data: {
        status: ReceivableStatus.VOID,
        voidAt: new Date(),
        voidReason: reason,
        remark: `作废操作人：${operator || 'system'}`,
      },
    });

    if (count === 0) {
      throw new BadRequestException('当前应收单状态不可作废');
    }

    return this.findReceivableDetail(id);
  }

  async getReceiptsByReceivableId(receivableId: number) {
    await this.findReceivableDetail(receivableId);
    return this.prisma.financeReceipt.findMany({
      where: { receivableId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertReceivableReceiptable(receivable: FinanceReceivable) {
    if (!RECEIVABLE_RECEIPTABLE_STATUSES.includes(receivable.status)) {
      throw new BadRequestException('当前应收单状态不可收款');
    }
  }

  private assertReceiptAmount(receivable: FinanceReceivable, amount: number) {
    const remainAmount =
      Number(receivable.totalAmount) - Number(receivable.receivedAmount);
    if (amount > remainAmount) {
      throw new BadRequestException(
        `收款金额不能超过剩余应收金额 ${remainAmount}`,
      );
    }
  }

  private assertReceiptIdempotent(
    existing: FinanceReceipt,
    receivableId: number,
    amount: number,
  ) {
    if (existing.receivableId !== receivableId) {
      throw new ConflictException('支付流水号已被其他应收单使用');
    }
    if (Number(existing.amount) !== amount) {
      throw new ConflictException('相同流水号的收款金额与本次请求不一致');
    }
  }

  private async applyReceivableReceipt(
    tx: Prisma.TransactionClient,
    fresh: FinanceReceivable,
    amount: number,
  ) {
    const newReceived = Number(fresh.receivedAmount) + amount;
    const isFullPaid = newReceived >= Number(fresh.totalAmount);
    const newStatus = isFullPaid
      ? ReceivableStatus.PAID
      : ReceivableStatus.PARTIAL;

    const { count } = await tx.financeReceivable.updateMany({
      where: {
        id: fresh.id,
        status: { in: RECEIVABLE_RECEIPTABLE_STATUSES },
        receivedAmount: fresh.receivedAmount,
      },
      data: {
        receivedAmount: newReceived,
        status: newStatus,
        paidAt: isFullPaid ? new Date() : null,
      },
    });

    if (count === 0) {
      throw new ConflictException('应收单已被其他操作更新，请刷新后重试');
    }
  }

  private buildReceiptResponse(result: FinanceReceivable) {
    return {
      receivableId: result.id,
      receivableNo: result.receivableNo,
      status: result.status,
      receivedAmount: result.receivedAmount,
      message: '收款成功',
    };
  }
}

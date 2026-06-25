import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  PayableStatus,
  FinancePayable,
  FinancePayment,
} from '@prisma/client';
import { PaymentDto } from './dto/payment.dto';
import {
  PAYABLE_PAYABLE_STATUSES,
  PAYABLE_VOIDABLE_STATUSES,
} from './constants/finance-status';

@Injectable()
export class PayableService {
  constructor(private readonly prisma: PrismaService) {}

  private generatePayableNo() {
    return `AP${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  async createPayable(
    params: {
      purchaseOrderId: number;
      purchaseOrderNo: string;
      supplierName: string;
      totalAmount: number;
      createdBy?: number;
      remark?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const executor = tx || this.prisma;
    const payableNo = this.generatePayableNo();

    return executor.financePayable.create({
      data: {
        payableNo,
        purchaseOrderId: params.purchaseOrderId,
        purchaseOrderNo: params.purchaseOrderNo,
        supplierName: params.supplierName,
        totalAmount: params.totalAmount,
        createdBy: params.createdBy,
        remark: params.remark,
        status: PayableStatus.PENDING,
      },
    });
  }

  async findPayableList(
    page = 1,
    pageSize = 10,
    status?: PayableStatus,
    keyword?: string,
  ) {
    const where: Prisma.FinancePayableWhereInput = {};
    if (status) where.status = status;
    if (keyword) {
      where.OR = [
        { payableNo: { contains: keyword } },
        { purchaseOrderNo: { contains: keyword } },
        { supplierName: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.financePayable.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: { purchaseOrder: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.financePayable.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async findPayableDetail(id: number) {
    const payable = await this.prisma.financePayable.findUnique({
      where: { id },
      include: {
        purchaseOrder: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payable) throw new NotFoundException('应付单不存在');
    return payable;
  }

  /**
   * 付款核销：事务内状态机 + payNo 幂等 + 乐观锁更新
   */
  async payment(id: number, dto: PaymentDto, operator?: string) {
    await this.findPayableDetail(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.financePayable.findUnique({ where: { id } });
      if (!fresh) throw new NotFoundException('应付单不存在');

      this.assertPayablePayable(fresh);
      this.assertPaymentAmount(fresh, dto.amount);

      if (dto.payNo) {
        const existingPayment = await tx.financePayment.findUnique({
          where: { payNo: dto.payNo },
        });
        if (existingPayment) {
          this.assertPaymentIdempotent(existingPayment, id, dto.amount);
          return tx.financePayable.findUniqueOrThrow({ where: { id } });
        }
      }

      try {
        await tx.financePayment.create({
          data: {
            payableId: id,
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
          const existingPayment = await tx.financePayment.findUnique({
            where: { payNo: dto.payNo },
          });
          if (existingPayment) {
            this.assertPaymentIdempotent(existingPayment, id, dto.amount);
            return tx.financePayable.findUniqueOrThrow({ where: { id } });
          }
        }
        throw error;
      }

      await this.applyPayablePayment(tx, fresh, dto.amount);
      return tx.financePayable.findUniqueOrThrow({ where: { id } });
    });

    return this.buildPaymentResponse(result);
  }

  async voidPayable(id: number, reason: string, operator?: string) {
    await this.findPayableDetail(id);

    const { count } = await this.prisma.financePayable.updateMany({
      where: {
        id,
        status: { in: PAYABLE_VOIDABLE_STATUSES },
      },
      data: {
        status: PayableStatus.VOID,
        voidAt: new Date(),
        voidReason: reason,
        remark: `作废操作人：${operator || 'system'}`,
      },
    });

    if (count === 0) {
      throw new BadRequestException('当前应付单状态不可作废');
    }

    return this.findPayableDetail(id);
  }

  async getPaymentsByPayableId(payableId: number) {
    await this.findPayableDetail(payableId);
    return this.prisma.financePayment.findMany({
      where: { payableId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertPayablePayable(payable: FinancePayable) {
    if (!PAYABLE_PAYABLE_STATUSES.includes(payable.status)) {
      throw new BadRequestException('当前应付单状态不可付款');
    }
  }

  private assertPaymentAmount(payable: FinancePayable, amount: number) {
    const remainAmount =
      Number(payable.totalAmount) - Number(payable.paidAmount);
    if (amount > remainAmount) {
      throw new BadRequestException(
        `付款金额不能超过剩余应付金额 ${remainAmount}`,
      );
    }
  }

  private assertPaymentIdempotent(
    existing: FinancePayment,
    payableId: number,
    amount: number,
  ) {
    if (existing.payableId !== payableId) {
      throw new ConflictException('付款流水号已被其他应付单使用');
    }
    if (Number(existing.amount) !== amount) {
      throw new ConflictException('相同流水号的付款金额与本次请求不一致');
    }
  }

  private async applyPayablePayment(
    tx: Prisma.TransactionClient,
    fresh: FinancePayable,
    amount: number,
  ) {
    const newPaid = Number(fresh.paidAmount) + amount;
    const isFullPaid = newPaid >= Number(fresh.totalAmount);
    const newStatus = isFullPaid ? PayableStatus.PAID : PayableStatus.PARTIAL;

    const { count } = await tx.financePayable.updateMany({
      where: {
        id: fresh.id,
        status: { in: PAYABLE_PAYABLE_STATUSES },
        paidAmount: fresh.paidAmount,
      },
      data: {
        paidAmount: newPaid,
        status: newStatus,
        paidAt: isFullPaid ? new Date() : null,
      },
    });

    if (count === 0) {
      throw new ConflictException('应付单已被其他操作更新，请刷新后重试');
    }
  }

  private buildPaymentResponse(result: FinancePayable) {
    return {
      payableId: result.id,
      payableNo: result.payableNo,
      status: result.status,
      paidAmount: result.paidAmount,
      message: '付款成功',
    };
  }
}

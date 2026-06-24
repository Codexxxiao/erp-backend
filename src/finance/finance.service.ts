import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ReceivableStatus } from '@prisma/client';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { ReceiptDto } from './dto/receipt.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // 生成应收单号
  private generateReceivableNo() {
    return `AR${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * 创建应收单（支持外部事务，供订单发货联动调用）
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

  /**
   * 分页查询应收单列表
   */
  async findReceivableList(
    page = 1,
    pageSize = 10,
    status?: ReceivableStatus,
    keyword?: string,
  ) {
    const where: any = {};
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

  /**
   * 查询应收单详情（含收款记录）
   */
  async findReceivableDetail(id: number) {
    const receivable = await this.prisma.financeReceivable.findUnique({
      where: { id },
      include: { order: true, receipts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!receivable) throw new NotFoundException('应收单不存在');
    return receivable;
  }

  /**
   * 收款核销（事务原子性）
   * 1. 校验应收单状态与剩余金额
   * 2. 写入收款记录
   * 3. 更新应收单已收金额与状态
   */
  async receipt(id: number, dto: ReceiptDto, operator?: string) {
    const receivable = await this.findReceivableDetail(id);

    // 状态校验：仅待收款、部分收款可收款
    const allowStatus: ReceivableStatus[] = [
      ReceivableStatus.PENDING,
      ReceivableStatus.PARTIAL,
    ];
    if (!allowStatus.includes(receivable.status)) {
      throw new BadRequestException('当前应收单状态不可收款');
    }

    // 计算剩余未收金额
    const remainAmount =
      Number(receivable.totalAmount) - Number(receivable.receivedAmount);
    if (dto.amount > remainAmount) {
      throw new BadRequestException(
        `收款金额不能超过剩余应收金额 ${remainAmount}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 写入收款记录
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

      // 2. 计算新的已收金额和状态
      const newReceived = Number(receivable.receivedAmount) + dto.amount;
      const isFullPaid = newReceived >= Number(receivable.totalAmount);
      const newStatus = isFullPaid
        ? ReceivableStatus.PAID
        : ReceivableStatus.PARTIAL;

      // 3. 更新应收单
      const updated = await tx.financeReceivable.update({
        where: { id },
        data: {
          receivedAmount: newReceived,
          status: newStatus,
          paidAt: isFullPaid ? new Date() : null,
        },
      });

      return updated;
    });

    return {
      receivableId: result.id,
      receivableNo: result.receivableNo,
      status: result.status,
      receivedAmount: result.receivedAmount,
      message: '收款成功',
    };
  }

  /**
   * 作废应收单
   */
  async voidReceivable(id: number, reason: string, operator?: string) {
    const receivable = await this.findReceivableDetail(id);

    if (receivable.status === ReceivableStatus.VOID) {
      throw new BadRequestException('应收单已作废，不可重复操作');
    }
    if (receivable.status === ReceivableStatus.PAID) {
      throw new BadRequestException('已结清的应收单不可作废，请先做退款处理');
    }

    return this.prisma.financeReceivable.update({
      where: { id },
      data: {
        status: ReceivableStatus.VOID,
        voidAt: new Date(),
        voidReason: reason,
        remark: `${receivable.remark || ''} | 作废操作人：${operator || 'system'}`,
      },
    });
  }

  /**
   * 查询应收单下的所有收款记录
   */
  async getReceiptsByReceivableId(receivableId: number) {
    await this.findReceivableDetail(receivableId);
    return this.prisma.financeReceipt.findMany({
      where: { receivableId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

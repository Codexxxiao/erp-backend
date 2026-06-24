import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PayableStatus } from '@prisma/client';
import { CreatePayableDto } from './dto/create-payable.dto';
import { PaymentDto } from './dto/payment.dto';

@Injectable()
export class PayableService {
  constructor(private readonly prisma: PrismaService) {}

  // 生成应付单号
  private generatePayableNo() {
    return `AP${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * 创建应付单（支持外部事务，供采购入库联动调用）
   */
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

  /**
   * 分页查询应付单列表
   */
  async findPayableList(
    page = 1,
    pageSize = 10,
    status?: PayableStatus,
    keyword?: string,
  ) {
    const where: any = {};
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

  /**
   * 查询应付单详情（含付款记录）
   */
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
   * 付款核销（事务原子性）
   * 1. 校验应付单状态与剩余金额
   * 2. 写入付款记录
   * 3. 更新应付单已付金额与状态
   */
  async payment(id: number, dto: PaymentDto, operator?: string) {
    const payable = await this.findPayableDetail(id);

    // 状态校验
    const allowStatus = [PayableStatus.PENDING, PayableStatus.PARTIAL];
    if (!allowStatus.includes(payable.status)) {
      throw new BadRequestException('当前应付单状态不可付款');
    }

    // 计算剩余未付金额
    const remainAmount =
      Number(payable.totalAmount) - Number(payable.paidAmount);
    if (dto.amount > remainAmount) {
      throw new BadRequestException(
        `付款金额不能超过剩余应付金额 ${remainAmount}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 写入付款记录
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

      // 2. 计算新的已付金额和状态
      const newPaid = Number(payable.paidAmount) + dto.amount;
      const isFullPaid = newPaid >= Number(payable.totalAmount);
      const newStatus = isFullPaid ? PayableStatus.PAID : PayableStatus.PARTIAL;

      // 3. 更新应付单
      const updated = await tx.financePayable.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          status: newStatus,
          paidAt: isFullPaid ? new Date() : null,
        },
      });

      return updated;
    });

    return {
      payableId: result.id,
      payableNo: result.payableNo,
      status: result.status,
      paidAmount: result.paidAmount,
      message: '付款成功',
    };
  }

  /**
   * 作废应付单
   */
  async voidPayable(id: number, reason: string, operator?: string) {
    const payable = await this.findPayableDetail(id);

    if (payable.status === PayableStatus.VOID) {
      throw new BadRequestException('应付单已作废，不可重复操作');
    }
    if (payable.status === PayableStatus.PAID) {
      throw new BadRequestException('已结清的应付单不可作废，请先做退款处理');
    }

    return this.prisma.financePayable.update({
      where: { id },
      data: {
        status: PayableStatus.VOID,
        voidAt: new Date(),
        voidReason: reason,
        remark: `${payable.remark || ''} | 作废操作人：${operator || 'system'}`,
      },
    });
  }

  /**
   * 查询应付单下的所有付款记录
   */
  async getPaymentsByPayableId(payableId: number) {
    await this.findPayableDetail(payableId);
    return this.prisma.financePayment.findMany({
      where: { payableId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

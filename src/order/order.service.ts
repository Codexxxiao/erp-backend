import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, OrderLogType, Prisma } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ConfirmReceiveDto } from './dto/confirm-receive.dto';
import { ApplyRefundDto } from './dto/apply-refund.dto';
import { FinishRefundDto } from './dto/finish-refund.dto';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
  ) {}

  // 生成订单号
  private generateOrderNo() {
    return `SO${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * 私有通用方法：写入操作日志
   * @param tx Prisma事务实例，保证原子性
   */
  private async addLog(
    tx: Prisma.TransactionClient,
    params: {
      orderId: number;
      type: OrderLogType;
      operator?: string;
      beforeStatus?: OrderStatus;
      afterStatus?: OrderStatus;
      remark?: string;
      ip?: string;
    },
  ) {
    await tx.orderLog.create({
      data: {
        orderId: params.orderId,
        type: params.type,
        operator: params.operator || 'system',
        beforeStatus: params.beforeStatus,
        afterStatus: params.afterStatus,
        remark: params.remark,
        ip: params.ip,
      },
    });
  }

  /**
   * 创建订单 + 扣减库存（事务原子性）
   */
  async createOrder(dto: CreateOrderDto, userId?: number, ip?: string) {
    const { items, warehouseId, locationId, ...baseInfo } = dto;

    // 1. 校验SKU有效性
    const skuList = await this.prisma.sku.findMany({
      where: { id: { in: items.map((i) => i.skuId) }, status: 1 },
    });
    if (skuList.length !== items.length) {
      throw new BadRequestException('存在无效或已下架的SKU');
    }

    const skuMap = new Map(skuList.map((sku) => [sku.id, sku]));
    let totalAmount = 0;
    let totalCost = 0;

    // 2. 计算每行明细的售价、成本、毛利
    const orderItemsData = items.map((item) => {
      const sku = skuMap.get(item.skuId)!;
      const price = Number(sku.price);
      const subtotal = price * item.quantity;
      const unitCost = Number(sku.currentCost || 0);
      const costAmount = unitCost * item.quantity;
      const profit = subtotal - costAmount;

      totalAmount += subtotal;
      totalCost += costAmount;

      return {
        skuId: item.skuId,
        skuName: sku.specName,
        price,
        quantity: item.quantity,
        subtotal,
        costAmount, // 销售成本
        profit, // 明细毛利
      };
    });

    const orderNo = this.generateOrderNo();
    const totalProfit = totalAmount - totalCost;

    // 3. 开启事务
    const order = await this.prisma.$transaction(async (tx) => {
      // 3.1 创建订单主表
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          totalAmount,
          warehouseId,
          locationId,
          createdBy: userId,
          status: OrderStatus.PENDING_REVIEW,
          ...baseInfo,
        },
      });

      // 3.2 创建订单明细（携带成本与毛利）
      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({ orderId: newOrder.id, ...item })),
      });

      // 3.3 逐个扣减库存，写入流水与单位成本
      for (const item of items) {
        const sku = skuMap.get(item.skuId)!;
        await this.inventoryService.changeStock(tx, {
          skuId: item.skuId,
          locationId,
          type: 'OUT',
          reason: 'ORDER',
          quantity: item.quantity,
          billNo: orderNo,
          operator: userId ? String(userId) : 'system',
          remark: '订单出库',
          unitCost: Number(sku.currentCost || 0),
        });
      }

      // 3.4 写入创建日志
      await this.addLog(tx, {
        orderId: newOrder.id,
        type: OrderLogType.CREATE,
        operator: userId ? String(userId) : 'system',
        afterStatus: OrderStatus.PENDING_REVIEW,
        remark: `订单创建，销售额：${totalAmount}，成本：${totalCost}，毛利：${totalProfit}`,
        ip,
      });

      return newOrder;
    });

    return {
      orderId: order.id,
      orderNo,
      totalAmount,
      totalCost,
      totalProfit,
      status: order.status,
    };
  }

  /**
   * 分页查询订单
   */
  async findList(page = 1, pageSize = 10, status?: OrderStatus) {
    const where = status ? { status } : {};
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: { items: true, warehouse: true, location: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /**
   * 查询订单详情
   */
  async findDetail(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { sku: true } },
        warehouse: true,
        location: true,
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  // ========== 状态流转核心方法 ==========

  /**
   * 1. 审核通过：待审核 → 待发货
   */
  async reviewOrder(
    id: number,
    dto: ReviewOrderDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.PENDING_REVIEW) {
      throw new BadRequestException('仅待审核状态的订单可审核');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.PENDING_SHIP,
          remark: dto.remark || order.remark,
        },
      });

      // 写入审核日志
      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.REVIEW,
        operator,
        beforeStatus: OrderStatus.PENDING_REVIEW,
        afterStatus: OrderStatus.PENDING_SHIP,
        remark: dto.remark,
        ip,
      });

      return updated;
    });

    return result;
  }

  /**
   * 2. 取消订单：待审核/待发货 → 已取消（事务回滚库存）
   */
  async cancelOrder(
    id: number,
    dto: CancelOrderDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    const allowCancelStatus: OrderStatus[] = [
      OrderStatus.PENDING_REVIEW,
      OrderStatus.PENDING_SHIP,
    ];
    if (!allowCancelStatus.includes(order.status)) {
      throw new BadRequestException(
        '当前订单状态不可取消，已发货订单请走售后流程',
      );
    }

    const beforeStatus = order.status;
    const result = await this.prisma.$transaction(async (tx) => {
      const cancelledOrder = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
        include: { items: true },
      });

      // 回滚库存
      for (const item of order.items) {
        const sku = await tx.sku.findUnique({ where: { id: item.skuId } });
        await this.inventoryService.changeStock(tx, {
          skuId: item.skuId,
          locationId: order.locationId,
          type: 'IN',
          reason: 'ORDER_CANCEL',
          quantity: item.quantity,
          billNo: order.orderNo,
          operator,
          remark: '订单取消回滚库存',
          unitCost: Number(sku?.currentCost || 0),
        });
      }

      // 写入取消日志
      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.CANCEL,
        operator,
        beforeStatus,
        afterStatus: OrderStatus.CANCELLED,
        remark: dto.reason,
        ip,
      });

      return cancelledOrder;
    });

    return {
      orderId: result.id,
      orderNo: result.orderNo,
      status: result.status,
      message: '订单取消成功，库存已回滚',
    };
  }

  /**
   * 3. 订单发货：待发货 → 已发货
   */
  async shipOrder(
    id: number,
    dto: ShipOrderDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.PENDING_SHIP) {
      throw new BadRequestException('仅待发货状态的订单可发货');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.SHIPPED,
          shippedAt: new Date(),
          remark: dto.remark || order.remark,
        },
      });

      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.SHIP,
        operator,
        beforeStatus: OrderStatus.PENDING_SHIP,
        afterStatus: OrderStatus.SHIPPED,
        remark: `物流公司：${dto.logisticsCompany}，单号：${dto.trackingNo}`,
        ip,
      });

      // 同步生成应收单（传入同一事务tx，保证原子性）
      await this.financeService.createReceivable(
        {
          orderId: order.id,
          orderNo: order.orderNo,
          customerName: order.receiverName,
          totalAmount: Number(order.totalAmount),
          createdBy: operator ? Number(operator) : undefined,
          remark: `订单发货自动生成应收，物流：${dto.logisticsCompany}`,
        },
        tx,
      );

      return updated;
    });

    return result;
  }

  /**
   * 4. 确认收货：已发货 → 已完成
   */
  async confirmReceive(
    id: number,
    dto: ConfirmReceiveDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('仅已发货状态的订单可确认收货');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          remark: dto.remark || order.remark,
        },
      });

      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.RECEIVE,
        operator,
        beforeStatus: OrderStatus.SHIPPED,
        afterStatus: OrderStatus.COMPLETED,
        remark: dto.remark,
        ip,
      });

      return updated;
    });

    return result;
  }

  /**
   * 5. 发起售后：已发货/已完成 → 售后中
   */
  async applyRefund(
    id: number,
    dto: ApplyRefundDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    const allowStatus: OrderStatus[] = [
      OrderStatus.SHIPPED,
      OrderStatus.COMPLETED,
    ];
    if (!allowStatus.includes(order.status)) {
      throw new BadRequestException('仅已发货或已完成的订单可发起售后');
    }
    const beforeStatus = order.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.REFUNDING,
          refundReason: dto.reason,
        },
      });

      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.REFUND_APPLY,
        operator,
        beforeStatus,
        afterStatus: OrderStatus.REFUNDING,
        remark: dto.reason,
        ip,
      });

      return updated;
    });

    return result;
  }

  /**
   * 6. 完成售后：售后中 → 已完成（可选退货入库）
   */
  async finishRefund(
    id: number,
    dto: FinishRefundDto,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.REFUNDING) {
      throw new BadRequestException('仅售后中的订单可完成处理');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.COMPLETED,
          refundedAt: new Date(),
          remark: dto.remark || order.remark,
        },
        include: { items: true },
      });

      // 退货则库存回滚
      if (dto.isReturnGoods) {
        for (const item of order.items) {
          await this.inventoryService.changeStock(tx, {
            skuId: item.skuId,
            locationId: order.locationId,
            type: 'IN',
            reason: 'REFUND',
            quantity: item.quantity,
            billNo: order.orderNo,
            operator,
            remark: '售后退货入库',
          });
        }
      }

      // 写入售后完成日志
      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.REFUND_FINISH,
        operator,
        beforeStatus: OrderStatus.REFUNDING,
        afterStatus: OrderStatus.COMPLETED,
        remark: dto.isReturnGoods
          ? `售后完成，已退货入库。${dto.remark || ''}`
          : `售后完成，仅退款。${dto.remark || ''}`,
        ip,
      });

      return updatedOrder;
    });

    return {
      orderId: result.id,
      orderNo: result.orderNo,
      status: result.status,
      isReturnGoods: dto.isReturnGoods,
      message: '售后处理完成',
    };
  }

  /**
   * 7. 关闭售后：售后中 → 已完成（驳回售后）
   */
  async closeRefund(
    id: number,
    remark?: string,
    operator?: string,
    ip?: string,
  ) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.REFUNDING) {
      throw new BadRequestException('仅售后中的订单可关闭');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.COMPLETED,
          remark: remark || order.remark,
        },
      });

      await this.addLog(tx, {
        orderId: id,
        type: OrderLogType.REFUND_CLOSE,
        operator,
        beforeStatus: OrderStatus.REFUNDING,
        afterStatus: OrderStatus.COMPLETED,
        remark: remark || '售后驳回关闭',
        ip,
      });

      return updated;
    });

    return result;
  }

  /**
   * 查询订单操作日志
   */
  async getOrderLogs(orderId: number) {
    // 先校验订单存在
    await this.findDetail(orderId);
    return this.prisma.orderLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 统计指定时间范围内的经营数据
   */
  async getProfitStats(startDate?: string, endDate?: string) {
    const where: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.CANCELLED },
    };
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: { items: true },
    });

    const orderCount = orders.length;
    const totalSales = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalCost = orders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + Number(i.costAmount), 0),
      0,
    );
    const totalProfit = totalSales - totalCost;
    const profitRate =
      totalSales > 0 ? Math.round((totalProfit / totalSales) * 10000) / 100 : 0;

    return {
      orderCount,
      totalSales,
      totalCost,
      totalProfit,
      profitRate, // 毛利率，百分比
      statRange: { startDate, endDate },
    };
  }
}

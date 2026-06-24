import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PurchaseOrderStatus,
  ReceivableStatus,
  PayableStatus,
} from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 经营总览看板数据
   * @param startDate 开始日期 YYYY-MM-DD
   * @param endDate 结束日期 YYYY-MM-DD
   */
  async getOverview(startDate?: string, endDate?: string) {
    // 构造时间范围条件
    const orderWhere: any = { status: { not: OrderStatus.CANCELLED } };
    const purchaseWhere: any = {
      status: { not: PurchaseOrderStatus.CANCELLED },
    };
    if (startDate) {
      const start = new Date(startDate);
      orderWhere.createdAt = { gte: start };
      purchaseWhere.createdAt = { gte: start };
    }
    if (endDate) {
      const end = new Date(endDate + ' 23:59:59');
      orderWhere.createdAt = { ...orderWhere.createdAt, lte: end };
      purchaseWhere.createdAt = { ...purchaseWhere.createdAt, lte: end };
    }

    // 并行查询所有指标，提升性能
    const [
      salesStats,
      orderStatusStats,
      profitTop10,
      inventoryStats,
      purchaseStats,
      financeStats,
    ] = await Promise.all([
      this.getSalesStats(orderWhere),
      this.getOrderStatusDistribution(orderWhere),
      this.getProfitTop10(orderWhere),
      this.getInventoryStats(),
      this.getPurchaseStats(purchaseWhere),
      this.getFinanceStats(),
    ]);

    return {
      summary: {
        orderCount: salesStats.orderCount,
        totalSales: salesStats.totalSales,
        totalCost: salesStats.totalCost,
        totalProfit: salesStats.totalProfit,
        profitRate: salesStats.profitRate,
        totalPurchase: purchaseStats.totalAmount,
        receivableBalance: financeStats.receivableBalance,
        payableBalance: financeStats.payableBalance,
      },
      sales: {
        ...salesStats,
        statusDistribution: orderStatusStats,
      },
      profit: {
        totalProfit: salesStats.totalProfit,
        profitRate: salesStats.profitRate,
        top10Sku: profitTop10,
      },
      inventory: inventoryStats,
      purchase: purchaseStats,
      finance: financeStats,
    };
  }

  // ========== 销售统计 ==========
  private async getSalesStats(where: any) {
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
    const avgPrice =
      orderCount > 0 ? Math.round((totalSales / orderCount) * 100) / 100 : 0;

    const pendingShip = orders.filter(
      (o) => o.status === OrderStatus.PENDING_SHIP,
    ).length;
    const shipped = orders.filter(
      (o) => o.status === OrderStatus.SHIPPED,
    ).length;
    const completed = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED,
    ).length;

    return {
      orderCount,
      totalSales,
      totalCost,
      totalProfit,
      profitRate,
      avgPrice,
      pendingShip,
      shipped,
      completed,
    };
  }

  // ========== 订单状态分布 ==========
  private async getOrderStatusDistribution(where: any) {
    const orders = await this.prisma.order.findMany({
      where,
      select: { status: true },
    });
    const distribution: Record<string, number> = {};
    orders.forEach((o) => {
      distribution[o.status] = (distribution[o.status] || 0) + 1;
    });
    return distribution;
  }

  // ========== 商品毛利TOP10 ==========
  private async getProfitTop10(where: any) {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: where },
      include: { sku: true },
    });

    // 按SKU聚合
    const skuMap = new Map<number, any>();
    orderItems.forEach((item) => {
      const skuId = item.skuId;
      if (!skuMap.has(skuId)) {
        skuMap.set(skuId, {
          skuId,
          skuName: item.skuName,
          quantity: 0,
          salesAmount: 0,
          costAmount: 0,
          profit: 0,
        });
      }
      const stat = skuMap.get(skuId)!;
      stat.quantity += item.quantity;
      stat.salesAmount += Number(item.subtotal);
      stat.costAmount += Number(item.costAmount);
      stat.profit += Number(item.profit);
    });

    // 按毛利降序取前10
    return Array.from(skuMap.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }

  // ========== 库存统计 ==========
  private async getInventoryStats() {
    const inventories = await this.prisma.inventory.findMany({
      include: { sku: true },
    });

    let totalValue = 0;
    let totalQty = 0;
    const skuSet = new Set<number>();
    const lowStockList: any[] = [];
    const lowStockThreshold = 10; // 低库存预警阈值

    inventories.forEach((inv) => {
      const qty = inv.quantity;
      const cost = Number(inv.sku.currentCost || 0);
      totalQty += qty;
      totalValue += qty * cost;
      skuSet.add(inv.skuId);

      if (qty <= lowStockThreshold) {
        lowStockList.push({
          skuId: inv.skuId,
          skuName: inv.sku.specName,
          quantity: qty,
          unitCost: cost,
        });
      }
    });

    const totalSku = await this.prisma.sku.count({ where: { status: 1 } });

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalQuantity: totalQty,
      totalSku,
      inStockSku: skuSet.size,
      lowStockList: lowStockList.sort((a, b) => a.quantity - b.quantity),
    };
  }

  // ========== 采购统计 ==========
  private async getPurchaseStats(where: any) {
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where,
      include: { items: true },
    });

    const totalCount = purchaseOrders.length;
    const totalAmount = purchaseOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalInQty = purchaseOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.inQuantity, 0),
      0,
    );
    const supplierCount = await this.prisma.supplier.count({
      where: { status: 1 },
    });

    return {
      totalCount,
      totalAmount,
      totalInQuantity: totalInQty,
      supplierCount,
    };
  }

  // ========== 财务统计 ==========
  private async getFinanceStats() {
    // 应收统计
    const receivables = await this.prisma.financeReceivable.findMany({
      where: { status: { not: ReceivableStatus.VOID } },
    });
    const receivableTotal = receivables.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const receivedTotal = receivables.reduce(
      (sum, r) => sum + Number(r.receivedAmount),
      0,
    );
    const receivableBalance = receivableTotal - receivedTotal;

    // 应付统计
    const payables = await this.prisma.financePayable.findMany({
      where: { status: { not: PayableStatus.VOID } },
    });
    const payableTotal = payables.reduce(
      (sum, p) => sum + Number(p.totalAmount),
      0,
    );
    const paidTotal = payables.reduce(
      (sum, p) => sum + Number(p.paidAmount),
      0,
    );
    const payableBalance = payableTotal - paidTotal;

    return {
      receivableTotal,
      receivedTotal,
      receivableBalance,
      payableTotal,
      paidTotal,
      payableBalance,
    };
  }
}

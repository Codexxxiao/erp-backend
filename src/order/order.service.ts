import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // 生成订单号
  private generateOrderNo() {
    return `SO${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * 创建订单 + 扣减库存（事务原子性）
   */
  async createOrder(dto: CreateOrderDto, userId?: number) {
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
    const orderItemsData = items.map((item) => {
      const sku = skuMap.get(item.skuId)!;
      const subtotal = Number(sku.price) * item.quantity;
      totalAmount += subtotal;
      return {
        skuId: item.skuId,
        skuName: sku.specName,
        price: sku.price,
        quantity: item.quantity,
        subtotal,
      };
    });

    const orderNo = this.generateOrderNo();

    // 2. 开启事务
    const order = await this.prisma.$transaction(async (tx) => {
      // 2.1 创建订单主表
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          totalAmount,
          warehouseId,
          createdBy: userId,
          status: OrderStatus.PENDING_REVIEW,
          ...baseInfo,
        },
      });

      // 2.2 创建订单明细
      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({ orderId: newOrder.id, ...item })),
      });

      // 2.3 逐个扣减库存，写入流水
      for (const item of items) {
        await this.inventoryService.changeStock(tx, {
          skuId: item.skuId,
          locationId,
          type: 'OUT',
          reason: 'ORDER',
          quantity: item.quantity,
          billNo: orderNo,
          operator: userId ? String(userId) : 'system',
          remark: '订单出库',
        });
      }

      return newOrder;
    });

    return { orderId: order.id, orderNo, totalAmount, status: order.status };
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
        include: { items: true, warehouse: true },
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
      include: { items: { include: { sku: true } }, warehouse: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  /**
   * 订单发货（更新状态为已发货）
   */
  async shipOrder(id: number, dto: ShipOrderDto) {
    const order = await this.findDetail(id);
    if (order.status !== OrderStatus.PENDING_SHIP) {
      throw new BadRequestException('当前订单状态不可发货');
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.SHIPPED,
        shippedAt: new Date(),
        remark: dto.remark,
      },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseInDto } from './dto/purchase-in.dto';
import { PayableService } from '../finance/payable.service';
import { PurchaseReturnDto } from './dto/purchase-return.dto';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly payableService: PayableService,
  ) {}

  // 生成采购单号
  private generateOrderNo() {
    return `PO${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  // ========== 供应商管理 ==========
  async createSupplier(dto: CreateSupplierDto) {
    const exist = await this.prisma.supplier.findUnique({
      where: { name: dto.name },
    });
    if (exist) throw new ConflictException('供应商名称已存在');
    return this.prisma.supplier.create({ data: dto });
  }

  findAllSuppliers(keyword?: string) {
    const where = keyword ? { name: { contains: keyword } } : {};
    return this.prisma.supplier.findMany({ where, orderBy: { id: 'desc' } });
  }

  async updateSupplier(id: number, dto: UpdateSupplierDto) {
    const exist = await this.prisma.supplier.findUnique({ where: { id } });
    if (!exist) throw new NotFoundException('供应商不存在');
    if (dto.name) {
      const sameName = await this.prisma.supplier.findUnique({
        where: { name: dto.name },
      });
      if (sameName && sameName.id !== id)
        throw new ConflictException('供应商名称已存在');
    }
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async removeSupplier(id: number) {
    const exist = await this.prisma.supplier.findUnique({ where: { id } });
    if (!exist) throw new NotFoundException('供应商不存在');
    return this.prisma.supplier.delete({ where: { id } });
  }

  // ========== 采购单管理 ==========
  /**
   * 创建采购单（初始状态：待审核）
   */
  async createPurchaseOrder(dto: CreatePurchaseDto, userId?: number) {
    const { items, supplierId, warehouseId, locationId, remark } = dto;

    // 1. 校验SKU有效性
    const skuList = await this.prisma.sku.findMany({
      where: { id: { in: items.map((i) => i.skuId) }, status: 1 },
    });
    if (skuList.length !== items.length) {
      throw new BadRequestException('存在无效的SKU');
    }

    const skuMap = new Map(skuList.map((sku) => [sku.id, sku]));
    let totalAmount = 0;
    const itemsData = items.map((item) => {
      const sku = skuMap.get(item.skuId)!;
      const subtotal = item.price * item.quantity;
      totalAmount += subtotal;
      return {
        skuId: item.skuId,
        skuName: sku.specName,
        quantity: item.quantity,
        price: item.price,
        subtotal,
        inQuantity: 0,
      };
    });

    const orderNo = this.generateOrderNo();

    // 2. 创建采购单及明细
    const order = await this.prisma.purchaseOrder.create({
      data: {
        orderNo,
        supplierId,
        warehouseId,
        locationId,
        totalAmount,
        createdBy: userId,
        remark,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    return { orderId: order.id, orderNo, totalAmount, status: order.status };
  }

  /**
   * 分页查询采购单
   */
  async findPurchaseList(
    page = 1,
    pageSize = 10,
    status?: PurchaseOrderStatus,
  ) {
    const where = status ? { status } : {};
    const [list, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: { supplier: true, warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /**
   * 采购单详情
   */
  async findPurchaseDetail(id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        items: { include: { sku: true } },
      },
    });
    if (!order) throw new NotFoundException('采购单不存在');
    return order;
  }

  /**
   * 审核采购单（状态变更为已审核，才可入库）
   */
  async approveOrder(id: number) {
    const order = await this.findPurchaseDetail(id);
    if (order.status !== PurchaseOrderStatus.PENDING_REVIEW) {
      throw new BadRequestException('仅待审核状态的采购单可审核');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * 取消采购单
   */
  async cancelOrder(id: number) {
    const order = await this.findPurchaseDetail(id);
    if (order.status === PurchaseOrderStatus.COMPLETED) {
      throw new BadRequestException('已完成的采购单不可取消');
    }
    if (order.status === PurchaseOrderStatus.PARTIAL_IN) {
      throw new BadRequestException('已部分入库的采购单不可取消');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });
  }

  /**
   * 核心：采购入库（事务原子性）
   * 1. 更新明细已入库数量
   * 2. 增加物理库存
   * 3. 写入库存流水
   * 4. 更新采购单状态（部分入库/已完成）
   */
  async purchaseIn(orderId: number, dto: PurchaseInDto, operator?: string) {
    const order = await this.findPurchaseDetail(orderId);

    if (
      ![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIAL_IN].includes(
        order.status,
      )
    ) {
      throw new BadRequestException('当前状态不可入库');
    }

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    let totalInAmount = 0;

    // 预校验并计算本次入库总金额
    for (const inItem of dto.items) {
      const detail = itemMap.get(inItem.itemId);
      if (!detail)
        throw new BadRequestException(`明细ID ${inItem.itemId} 不存在`);
      const remainQty = detail.quantity - detail.inQuantity;
      if (inItem.quantity > remainQty) {
        throw new BadRequestException(
          `SKU ${detail.skuName} 入库数量超过剩余待入库数量`,
        );
      }
      totalInAmount += Number(detail.price) * inItem.quantity;
    }

    // 开启事务
    const result = await this.prisma.$transaction(async (tx) => {
      let allCompleted = true;

      for (const inItem of dto.items) {
        const detail = itemMap.get(inItem.itemId)!;
        const newInQty = detail.inQuantity + inItem.quantity;

        // 1. 更新采购明细已入库数量
        await tx.purchaseOrderItem.update({
          where: { id: inItem.itemId },
          data: { inQuantity: newInQty },
        });

        // 2. 查询该SKU当前库存与单位成本
        const sku = await tx.sku.findUnique({ where: { id: detail.skuId } });
        const inventory = await tx.inventory.findUnique({
          where: {
            skuId_locationId: {
              skuId: detail.skuId,
              locationId: order.locationId,
            },
          },
        });

        const oldQty = inventory?.quantity || 0;
        const oldCost = Number(sku?.currentCost || 0);
        const inPrice = Number(detail.price);
        const inQty = inItem.quantity;

        // 3. 计算移动加权平均单位成本
        let newUnitCost: number;
        if (oldQty === 0) {
          // 原库存为0，直接用本次入库单价
          newUnitCost = inPrice;
        } else {
          const totalCost = oldQty * oldCost + inQty * inPrice;
          const totalQty = oldQty + inQty;
          // 保留2位小数
          newUnitCost = Math.round((totalCost / totalQty) * 100) / 100;
        }

        // 4. 更新SKU的当前单位成本
        await tx.sku.update({
          where: { id: detail.skuId },
          data: { currentCost: newUnitCost },
        });

        // 5. 增加库存 + 写入流水（携带单位成本）
        await this.inventoryService.changeStock(tx, {
          skuId: detail.skuId,
          locationId: order.locationId,
          type: 'IN',
          reason: 'PURCHASE',
          quantity: inItem.quantity,
          billNo: order.orderNo,
          operator,
          remark: '采购入库',
          unitCost: newUnitCost,
        });

        if (newInQty < detail.quantity) allCompleted = false;
      }

      // 6. 更新采购单状态
      const newStatus = allCompleted
        ? PurchaseOrderStatus.COMPLETED
        : PurchaseOrderStatus.PARTIAL_IN;

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          completedAt: allCompleted ? new Date() : null,
        },
        include: { items: true, supplier: true },
      });

      // 7. 生成应付单
      await this.payableService.createPayable(
        {
          purchaseOrderId: order.id,
          purchaseOrderNo: order.orderNo,
          supplierName: order.supplier.name,
          totalAmount: totalInAmount,
          createdBy: operator ? Number(operator) : undefined,
          remark: `采购入库自动生成应付，本次入库金额：${totalInAmount}`,
        },
        tx,
      );

      return updatedOrder;
    });

    return {
      orderId: result.id,
      orderNo: result.orderNo,
      status: result.status,
      payableAmount: totalInAmount,
      message: '入库成功，成本已加权更新，应付单已生成',
    };
  }
  /**
   * 采购退货：扣减库存 + 回退成本 + 更新已入库数量 + 生成红字应付单（事务原子性）
   * 成本规则：按原采购单价冲减总成本，重新计算移动加权平均单位成本
   */
  async purchaseReturn(
    orderId: number,
    dto: PurchaseReturnDto,
    operator?: string,
  ) {
    const order = await this.findPurchaseDetail(orderId);

    // 1. 状态校验：仅部分入库、已完成的采购单可退货
    const allowReturnStatus = [
      PurchaseOrderStatus.PARTIAL_IN,
      PurchaseOrderStatus.COMPLETED,
    ];
    if (!allowReturnStatus.includes(order.status)) {
      throw new BadRequestException('当前采购单状态不可退货');
    }

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    let totalReturnAmount = 0;

    // 2. 预校验：退货数量不能超过已入库数量
    for (const returnItem of dto.items) {
      const detail = itemMap.get(returnItem.itemId);
      if (!detail)
        throw new BadRequestException(`明细ID ${returnItem.itemId} 不存在`);
      if (returnItem.quantity > detail.inQuantity) {
        throw new BadRequestException(
          `SKU ${detail.skuName} 退货数量超过已入库数量`,
        );
      }
      // 计算本次退货总金额（按原采购单价）
      totalReturnAmount += Number(detail.price) * returnItem.quantity;
    }

    // 3. 开启事务
    const result = await this.prisma.$transaction(async (tx) => {
      let allReturned = true;

      for (const returnItem of dto.items) {
        const detail = itemMap.get(returnItem.itemId)!;
        const returnQty = returnItem.quantity;
        const returnPrice = Number(detail.price);

        // 3.1 更新采购明细已入库数量
        const newInQty = detail.inQuantity - returnQty;
        await tx.purchaseOrderItem.update({
          where: { id: returnItem.itemId },
          data: { inQuantity: newInQty },
        });

        // 3.2 查询当前库存与单位成本
        const inventory = await tx.inventory.findUnique({
          where: {
            skuId_locationId: {
              skuId: detail.skuId,
              locationId: order.locationId,
            },
          },
        });
        const sku = await tx.sku.findUnique({ where: { id: detail.skuId } });

        const currentQty = inventory?.quantity || 0;
        const currentCost = Number(sku?.currentCost || 0);

        if (currentQty < returnQty) {
          throw new BadRequestException(
            `SKU ${detail.skuName} 当前库存不足，无法退货`,
          );
        }

        // 3.3 核心：重新计算移动加权平均单位成本
        // 公式：新单位成本 = (原总成本 - 退货数量×原采购单价) / (原数量 - 退货数量)
        let newUnitCost = 0;
        const newQty = currentQty - returnQty;
        if (newQty > 0) {
          const oldTotalCost = currentQty * currentCost;
          const returnTotalCost = returnQty * returnPrice;
          const newTotalCost = oldTotalCost - returnTotalCost;
          newUnitCost = Math.round((newTotalCost / newQty) * 100) / 100;
        }

        // 3.4 更新SKU单位成本
        await tx.sku.update({
          where: { id: detail.skuId },
          data: { currentCost: newUnitCost },
        });

        // 3.5 扣减库存 + 写入流水（按原采购单价记录成本）
        await this.inventoryService.changeStock(tx, {
          skuId: detail.skuId,
          locationId: order.locationId,
          type: 'OUT',
          reason: 'PURCHASE_RETURN',
          quantity: returnQty,
          billNo: order.orderNo,
          operator,
          remark: `采购退货：${dto.remark || ''}`,
          unitCost: returnPrice, // 流水记录原采购单价，便于审计
        });

        // 判断是否全部退货完成
        if (newInQty > 0) allReturned = false;
      }

      // 3.6 更新采购单状态
      let newStatus: PurchaseOrderStatus;
      if (allReturned) {
        newStatus = PurchaseOrderStatus.CANCELLED; // 全部退货，标记为已取消
      } else {
        newStatus = PurchaseOrderStatus.PARTIAL_IN; // 部分退货，回到部分入库
      }

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          completedAt:
            newStatus === PurchaseOrderStatus.COMPLETED ? new Date() : null,
        },
        include: { items: true, supplier: true },
      });

      // 3.7 生成红字应付单（负金额，冲抵原应付）
      await this.payableService.createPayable(
        {
          purchaseOrderId: order.id,
          purchaseOrderNo: order.orderNo,
          supplierName: order.supplier.name,
          totalAmount: -totalReturnAmount, // 负数表示红字应付
          createdBy: operator ? Number(operator) : undefined,
          remark: `采购退货红字应付，退货原因：${dto.remark || ''}`,
        },
        tx,
      );

      return updatedOrder;
    });

    return {
      orderId: result.id,
      orderNo: result.orderNo,
      status: result.status,
      returnAmount: totalReturnAmount,
      message: '退货成功，库存已扣减，成本已回退，红字应付单已生成',
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { StockChangeDto } from './dto/stock-change.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { STATS_OVERVIEW_CACHE_KEY } from '../common/constants/cache-keys';

export type InventoryChangeType = 'IN' | 'OUT';
// 扩展变动原因类型
export type InventoryChangeReason =
  | 'PURCHASE'
  | 'ORDER'
  | 'ADJUST'
  | 'ORDER_CANCEL'
  | 'REFUND'
  | 'PURCHASE_RETURN';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private async clearStatsCache() {
    await this.cacheManager.del(STATS_OVERVIEW_CACHE_KEY);
  }

  // ========== 仓库管理 ==========
  async createWarehouse(dto: CreateWarehouseDto) {
    const exist = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
    });
    if (exist) throw new ConflictException('仓库编码已存在');
    return this.prisma.warehouse.create({ data: dto });
  }

  findAllWarehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { id: 'asc' } });
  }

  async updateWarehouse(id: number, dto: UpdateWarehouseDto) {
    const exist = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!exist) throw new NotFoundException('仓库不存在');
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async removeWarehouse(id: number) {
    await this.prisma.warehouse.findUnique({ where: { id } }).catch(() => {
      throw new NotFoundException('仓库不存在');
    });
    return this.prisma.warehouse.delete({ where: { id } });
  }

  // ========== 库位管理 ==========
  async createLocation(dto: CreateLocationDto) {
    const exist = await this.prisma.inventoryLocation.findUnique({
      where: { code: dto.code },
    });
    if (exist) throw new ConflictException('库位编码已存在');
    return this.prisma.inventoryLocation.create({ data: dto });
  }

  findAllLocations(warehouseId?: number) {
    const where = warehouseId ? { warehouseId } : {};
    return this.prisma.inventoryLocation.findMany({
      where,
      include: { warehouse: true },
    });
  }

  async updateLocation(id: number, dto: UpdateLocationDto) {
    const exist = await this.prisma.inventoryLocation.findUnique({
      where: { id },
    });
    if (!exist) throw new NotFoundException('库位不存在');
    return this.prisma.inventoryLocation.update({ where: { id }, data: dto });
  }

  async removeLocation(id: number) {
    await this.prisma.inventoryLocation
      .findUnique({ where: { id } })
      .catch(() => {
        throw new NotFoundException('库位不存在');
      });
    return this.prisma.inventoryLocation.delete({ where: { id } });
  }

  // ========== 核心：库存变动（支持事务） ==========
  async changeStock(
    tx: Prisma.TransactionClient,
    params: {
      skuId: number;
      locationId: number;
      type: InventoryChangeType;
      reason: InventoryChangeReason;
      quantity: number;
      billNo?: string;
      operator?: string;
      remark?: string;
      unitCost?: number;
    },
  ) {
    const {
      skuId,
      locationId,
      type,
      quantity,
      reason,
      billNo,
      operator,
      remark,
      unitCost,
    } = params;
    if (quantity <= 0) throw new BadRequestException('变动数量必须大于0');

    let inventory = await tx.inventory.findUnique({
      where: { skuId_locationId: { skuId, locationId } },
    });
    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { skuId, locationId, quantity: 0 },
      });
    }

    const beforeQty = inventory.quantity;
    let afterQty: number;

    if (type === 'OUT') {
      if (beforeQty < quantity) {
        throw new BadRequestException(
          `SKU ${skuId} 库存不足，当前：${beforeQty}，需扣减：${quantity}`,
        );
      }
      afterQty = beforeQty - quantity;
    } else {
      afterQty = beforeQty + quantity;
    }

    // 乐观锁更新，防止并发超卖
    await tx.inventory.update({
      where: { skuId_locationId: { skuId, locationId }, quantity: beforeQty },
      data: { quantity: afterQty },
    });

    await tx.inventoryLog.create({
      data: {
        inventoryId: inventory.id,
        skuId,
        locationId,
        type,
        reason,
        billNo,
        quantity,
        beforeQty,
        afterQty,
        operator,
        remark,
        unitCost,
      },
    });

    return { beforeQty, afterQty, unitCost };
  }

  // 手动调整库存（接口用，独立事务）
  async manualChangeStock(dto: StockChangeDto, operator?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      return this.changeStock(tx, {
        ...dto,
        reason: dto.reason as InventoryChangeReason,
        operator,
      });
    });
    await this.clearStatsCache();
    return result;
  }

  // ========== 库存查询 ==========
  async getStock(skuId: number, locationId: number) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { skuId_locationId: { skuId, locationId } },
      include: { sku: true, location: { include: { warehouse: true } } },
    });
    return inventory ?? { skuId, locationId, quantity: 0 };
  }

  getStockList(locationId?: number) {
    const where = locationId ? { locationId } : {};
    return this.prisma.inventory.findMany({
      where,
      include: { sku: true, location: { include: { warehouse: true } } },
    });
  }

  // 库存流水查询
  getStockLogs(skuId?: number, locationId?: number, page = 1, pageSize = 20) {
    const where: any = {};
    if (skuId) where.skuId = skuId;
    if (locationId) where.locationId = locationId;

    return Promise.all([
      this.prisma.inventoryLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { sku: true, location: true },
      }),
      this.prisma.inventoryLog.count({ where }),
    ]).then(([list, total]) => ({ list, total, page, pageSize }));
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import {
  OrderStatus,
  PurchaseOrderStatus,
  PurchaseReturnStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCategoryDto } from './dto/create-category.dto';

import { UpdateCategoryDto } from './dto/update-category.dto';

import { CreateProductDto } from './dto/create-product.dto';

import { UpdateProductDto } from './dto/update-product.dto';

import { CreateSkuDto } from './dto/create-sku.dto';

import { UpdateSkuDto } from './dto/update-sku.dto';

/** 销售侧未完成状态（除已完成、已取消外） */

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAY,

  OrderStatus.PENDING_REVIEW,

  OrderStatus.PENDING_SHIP,

  OrderStatus.SHIPPED,

  OrderStatus.REFUNDING,
];

/** 采购侧未完成状态 */

const ACTIVE_PURCHASE_STATUSES: PurchaseOrderStatus[] = [
  PurchaseOrderStatus.PENDING_REVIEW,

  PurchaseOrderStatus.APPROVED,

  PurchaseOrderStatus.PARTIAL_IN,
];

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== 分类管理 ==========

  async createCategory(dto: CreateCategoryDto) {
    const data = { ...dto };

    if (data.parentId != null) {
      await this.assertCategoryParentValid(null, data.parentId);
    }

    return this.prisma.productCategory.create({ data });
  }

  findAllCategories() {
    return this.prisma.productCategory.findMany({
      orderBy: { sort: 'asc' },

      include: { children: true },
    });
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const exist = await this.prisma.productCategory.findUnique({
      where: { id },
    });

    if (!exist) throw new NotFoundException('分类不存在');

    if (dto.parentId != null) {
      await this.assertCategoryParentValid(id, dto.parentId);
    }

    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: number) {
    const exist = await this.prisma.productCategory.findUnique({
      where: { id },
    });

    if (!exist) throw new NotFoundException('分类不存在');

    const [childCount, productCount] = await Promise.all([
      this.prisma.productCategory.count({ where: { parentId: id } }),

      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    if (childCount > 0) {
      throw new BadRequestException(
        `该分类下还有 ${childCount} 个子分类，无法删除`,
      );
    }

    if (productCount > 0) {
      throw new BadRequestException(
        `该分类下还有 ${productCount} 个商品，无法删除`,
      );
    }

    return this.prisma.productCategory.delete({ where: { id } });
  }

  // ========== SPU商品管理 ==========

  async createProduct(dto: CreateProductDto) {
    await this.assertCategoryAvailable(dto.categoryId);

    return this.prisma.product.create({ data: dto });
  }

  findAllProducts(page = 1, pageSize = 10, keyword?: string) {
    const where = keyword ? { name: { contains: keyword } } : {};

    return Promise.all([
      this.prisma.product.findMany({
        skip: (page - 1) * pageSize,

        take: pageSize,

        where,

        include: { category: true, skus: true },

        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.product.count({ where }),
    ]).then(([list, total]) => ({ list, total, page, pageSize }));
  }

  async findProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },

      include: { category: true, skus: true },
    });

    if (!product) throw new NotFoundException('商品不存在');

    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    await this.findProduct(id);

    if (dto.categoryId != null) {
      await this.assertCategoryAvailable(dto.categoryId);
    }

    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async removeProduct(id: number) {
    const product = await this.findProduct(id);

    for (const sku of product.skus) {
      await this.assertSkuDeletable(sku.id);
    }

    return this.prisma.product.delete({ where: { id } });
  }

  // ========== SKU管理 ==========

  async createSku(dto: CreateSkuDto) {
    const exist = await this.prisma.sku.findUnique({
      where: { skuCode: dto.skuCode },
    });

    if (exist) throw new ConflictException('SKU编码已存在');

    return this.prisma.sku.create({ data: dto });
  }

  findAllSkus(productId?: number) {
    const where = productId ? { productId } : {};

    return this.prisma.sku.findMany({ where, include: { product: true } });
  }

  async findSku(id: number) {
    const sku = await this.prisma.sku.findUnique({
      where: { id },

      include: { product: true },
    });

    if (!sku) throw new NotFoundException('SKU不存在');

    return sku;
  }

  async updateSku(id: number, dto: UpdateSkuDto) {
    await this.findSku(id);

    if (dto.skuCode) {
      const exist = await this.prisma.sku.findUnique({
        where: { skuCode: dto.skuCode },
      });

      if (exist && exist.id !== id)
        throw new ConflictException('SKU编码已存在');
    }

    return this.prisma.sku.update({ where: { id }, data: dto });
  }

  async removeSku(id: number) {
    await this.findSku(id);

    await this.assertSkuDeletable(id);

    return this.prisma.sku.delete({ where: { id } });
  }

  // ========== 私有校验 ==========

  /** 校验分类存在且已启用 */

  private async assertCategoryAvailable(categoryId: number) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`分类 ${categoryId} 不存在`);
    }

    if (category.status !== 1) {
      throw new BadRequestException('目标分类已禁用，无法关联商品');
    }
  }

  /** 从 parentId 向上追溯，防止循环引用 */

  private async assertCategoryParentValid(
    categoryId: number | null,

    parentId: number,
  ) {
    if (categoryId !== null && parentId === categoryId) {
      throw new BadRequestException('分类不能设置自身为父分类');
    }

    const parent = await this.prisma.productCategory.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException(`父分类 ${parentId} 不存在`);
    }

    let currentId: number | null = parentId;

    const visited = new Set<number>();

    while (currentId !== null) {
      if (categoryId !== null && currentId === categoryId) {
        throw new BadRequestException('不能将子分类设为父分类，会导致循环引用');
      }

      if (visited.has(currentId)) {
        throw new BadRequestException('分类树存在循环，请先修复数据');
      }

      visited.add(currentId);

      const node = await this.prisma.productCategory.findUnique({
        where: { id: currentId },

        select: { parentId: true },
      });

      currentId = node?.parentId ?? null;
    }
  }

  /** 删除 SKU 前：无库存、无未完成单据 */

  private async assertSkuDeletable(skuId: number) {
    const [stockAgg, activeOrderItem, activePurchaseItem, pendingReturnItem] =
      await Promise.all([
        this.prisma.inventory.aggregate({
          where: { skuId, quantity: { gt: 0 } },

          _sum: { quantity: true },
        }),

        this.prisma.orderItem.findFirst({
          where: {
            skuId,

            order: { status: { in: ACTIVE_ORDER_STATUSES } },
          },

          select: {
            id: true,

            order: { select: { orderNo: true, status: true } },
          },
        }),

        this.prisma.purchaseOrderItem.findFirst({
          where: {
            skuId,

            order: { status: { in: ACTIVE_PURCHASE_STATUSES } },
          },

          select: {
            id: true,

            order: { select: { orderNo: true, status: true } },
          },
        }),

        this.prisma.purchaseReturnItem.findFirst({
          where: {
            skuId,

            returnOrder: { status: PurchaseReturnStatus.PENDING_REVIEW },
          },

          select: { id: true },
        }),
      ]);

    const totalQty = stockAgg._sum.quantity ?? 0;

    if (totalQty > 0) {
      throw new BadRequestException(
        `SKU 仍有库存 ${totalQty} 件，请先清空库存后再删除`,
      );
    }

    if (activeOrderItem) {
      throw new BadRequestException(
        `SKU 关联未完成订单 ${activeOrderItem.order.orderNo}（${activeOrderItem.order.status}），无法删除`,
      );
    }

    if (activePurchaseItem) {
      throw new BadRequestException(
        `SKU 关联未完成采购单 ${activePurchaseItem.order.orderNo}（${activePurchaseItem.order.status}），无法删除`,
      );
    }

    if (pendingReturnItem) {
      throw new BadRequestException('SKU 关联待审核采购退货单，无法删除');
    }
  }
}

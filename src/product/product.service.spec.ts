import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PurchaseOrderStatus } from '@prisma/client';

describe('ProductService', () => {
  let service: ProductService;

  const prisma = {
    productCategory: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    sku: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    inventory: {
      aggregate: jest.fn(),
    },
    orderItem: {
      findFirst: jest.fn(),
    },
    purchaseOrderItem: {
      findFirst: jest.fn(),
    },
    purchaseReturnItem: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('removeCategory', () => {
    it('分类不存在时抛出 NotFoundException', async () => {
      prisma.productCategory.findUnique.mockResolvedValue(null);
      await expect(service.removeCategory(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('存在子分类时拒绝删除', async () => {
      prisma.productCategory.findUnique.mockResolvedValue({ id: 1 });
      prisma.productCategory.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(0);

      await expect(service.removeCategory(1)).rejects.toThrow(/2 个子分类/);
    });

    it('存在关联商品时拒绝删除', async () => {
      prisma.productCategory.findUnique.mockResolvedValue({ id: 1 });
      prisma.productCategory.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(3);

      await expect(service.removeCategory(1)).rejects.toThrow(/3 个商品/);
    });

    it('无子分类且无商品时允许删除', async () => {
      prisma.productCategory.findUnique.mockResolvedValue({ id: 1 });
      prisma.productCategory.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.productCategory.delete.mockResolvedValue({ id: 1 });

      await expect(service.removeCategory(1)).resolves.toEqual({ id: 1 });
    });
  });

  describe('updateCategory parentId', () => {
    it('不能将子分类设为父分类', async () => {
      prisma.productCategory.findUnique
        .mockResolvedValueOnce({ id: 1, parentId: null }) // exist
        .mockResolvedValueOnce({ id: 2, parentId: 1 }) // parent
        .mockResolvedValueOnce({ id: 2, parentId: 1 }); // walk: node 2

      await expect(service.updateCategory(1, { parentId: 2 })).rejects.toThrow(
        /循环引用/,
      );
    });

    it('不能设置自身为父分类', async () => {
      prisma.productCategory.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.updateCategory(1, { parentId: 1 })).rejects.toThrow(
        /自身为父分类/,
      );
    });
  });

  describe('removeSku', () => {
    beforeEach(() => {
      prisma.sku.findUnique.mockResolvedValue({ id: 1, product: {} });
      prisma.orderItem.findFirst.mockResolvedValue(null);
      prisma.purchaseOrderItem.findFirst.mockResolvedValue(null);
      prisma.purchaseReturnItem.findFirst.mockResolvedValue(null);
    });

    it('仍有库存时拒绝删除', async () => {
      prisma.inventory.aggregate.mockResolvedValue({
        _sum: { quantity: 5 },
      });

      await expect(service.removeSku(1)).rejects.toThrow(/库存 5 件/);
    });

    it('关联未完成订单时拒绝删除', async () => {
      prisma.inventory.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      prisma.orderItem.findFirst.mockResolvedValue({
        id: 1,
        order: { orderNo: 'SO20260101001', status: OrderStatus.PENDING_SHIP },
      });

      await expect(service.removeSku(1)).rejects.toThrow(/未完成订单/);
    });

    it('关联未完成采购单时拒绝删除', async () => {
      prisma.inventory.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      prisma.purchaseOrderItem.findFirst.mockResolvedValue({
        id: 1,
        order: {
          orderNo: 'PO20260101001',
          status: PurchaseOrderStatus.APPROVED,
        },
      });

      await expect(service.removeSku(1)).rejects.toThrow(/未完成采购单/);
    });

    it('无库存且无未完成单据时允许删除', async () => {
      prisma.inventory.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      prisma.sku.delete.mockResolvedValue({ id: 1 });

      await expect(service.removeSku(1)).resolves.toEqual({ id: 1 });
    });
  });

  describe('createProduct', () => {
    it('分类不存在时拒绝创建', async () => {
      prisma.productCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.createProduct({ name: '测试', categoryId: 99 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('分类已禁用时拒绝创建', async () => {
      prisma.productCategory.findUnique.mockResolvedValue({
        id: 1,
        status: 0,
      });

      await expect(
        service.createProduct({ name: '测试', categoryId: 1 }),
      ).rejects.toThrow(/已禁用/);
    });
  });
});

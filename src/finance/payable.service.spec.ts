import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayableService } from './payable.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayableStatus } from '@prisma/client';

describe('PayableService', () => {
  let service: PayableService;

  const prisma = {
    financePayable: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    financePayment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const basePayable = {
    id: 1,
    payableNo: 'AP001',
    purchaseOrderId: 10,
    purchaseOrderNo: 'PO001',
    supplierName: '供应商A',
    totalAmount: 200,
    paidAmount: 0,
    status: PayableStatus.PENDING,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [PayableService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PayableService>(PayableService);
  });

  describe('payment', () => {
    it('相同 payNo 幂等时不重复创建付款记录', async () => {
      prisma.financePayable.findUnique
        .mockResolvedValueOnce({
          ...basePayable,
          purchaseOrder: {},
          payments: [],
        })
        .mockResolvedValueOnce(basePayable);

      prisma.financePayable.findUniqueOrThrow.mockResolvedValue({
        ...basePayable,
        paidAmount: 100,
      });

      prisma.financePayment.findUnique.mockResolvedValue({
        id: 1,
        payableId: 1,
        amount: 100,
        payNo: 'TR001',
      });

      const result = await service.payment(1, {
        amount: 100,
        payMethod: '银行转账',
        payNo: 'TR001',
      });

      expect(result.message).toBe('付款成功');
      expect(prisma.financePayment.create).not.toHaveBeenCalled();
    });

    it('金额超过剩余应付时拒绝', async () => {
      prisma.financePayable.findUnique
        .mockResolvedValueOnce({
          ...basePayable,
          purchaseOrder: {},
          payments: [],
        })
        .mockResolvedValueOnce(basePayable);

      await expect(
        service.payment(1, {
          amount: 999,
          payMethod: '银行转账',
          payNo: 'TR002',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('乐观锁更新失败时抛出冲突', async () => {
      prisma.financePayable.findUnique
        .mockResolvedValueOnce({
          ...basePayable,
          purchaseOrder: {},
          payments: [],
        })
        .mockResolvedValueOnce(basePayable);

      prisma.financePayment.findUnique.mockResolvedValue(null);
      prisma.financePayment.create.mockResolvedValue({});
      prisma.financePayable.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.payment(1, {
          amount: 100,
          payMethod: '银行转账',
          payNo: 'TR003',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

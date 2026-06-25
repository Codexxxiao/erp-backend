import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceivableStatus } from '@prisma/client';

describe('FinanceService', () => {
  let service: FinanceService;

  const prisma = {
    financeReceivable: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    financeReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const baseReceivable = {
    id: 1,
    receivableNo: 'AR001',
    orderId: 10,
    orderNo: 'SO001',
    customerName: '张三',
    totalAmount: 100,
    receivedAmount: 0,
    status: ReceivableStatus.PENDING,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [FinanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReceivable', () => {
    it('同一订单已有有效应收时直接返回', async () => {
      prisma.financeReceivable.findFirst.mockResolvedValue(baseReceivable);

      await expect(
        service.createReceivable({
          orderId: 10,
          orderNo: 'SO001',
          customerName: '张三',
          totalAmount: 100,
        }),
      ).resolves.toEqual(baseReceivable);

      expect(prisma.financeReceivable.create).not.toHaveBeenCalled();
    });
  });

  describe('receipt', () => {
    beforeEach(() => {
      prisma.financeReceivable.findUnique
        .mockResolvedValueOnce({
          ...baseReceivable,
          order: {},
          receipts: [],
        })
        .mockResolvedValue(baseReceivable);
    });

    it('已结清状态不可收款', async () => {
      prisma.financeReceivable.findUnique.mockReset();
      prisma.financeReceivable.findUnique.mockResolvedValue({
        ...baseReceivable,
        status: ReceivableStatus.PAID,
        order: {},
        receipts: [],
      });

      await expect(
        service.receipt(1, {
          amount: 10,
          payMethod: '微信',
          payNo: 'WX001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('相同 payNo 幂等返回成功', async () => {
      prisma.financeReceivable.findUnique
        .mockReset()
        .mockResolvedValueOnce({
          ...baseReceivable,
          order: {},
          receipts: [],
        })
        .mockResolvedValueOnce(baseReceivable);

      prisma.financeReceivable.findUniqueOrThrow.mockResolvedValue({
        ...baseReceivable,
        receivedAmount: 50,
      });

      prisma.financeReceipt.findUnique.mockResolvedValue({
        id: 1,
        receivableId: 1,
        amount: 50,
        payNo: 'WX001',
      });

      const result = await service.receipt(1, {
        amount: 50,
        payMethod: '微信',
        payNo: 'WX001',
      });

      expect(result.message).toBe('收款成功');
      expect(prisma.financeReceipt.create).not.toHaveBeenCalled();
    });

    it('相同 payNo 但金额不同抛出冲突', async () => {
      prisma.financeReceivable.findUnique
        .mockReset()
        .mockResolvedValueOnce({
          ...baseReceivable,
          order: {},
          receipts: [],
        })
        .mockResolvedValueOnce(baseReceivable);

      prisma.financeReceipt.findUnique.mockResolvedValue({
        id: 1,
        receivableId: 1,
        amount: 50,
        payNo: 'WX001',
      });

      await expect(
        service.receipt(1, {
          amount: 60,
          payMethod: '微信',
          payNo: 'WX001',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('乐观锁更新失败时抛出冲突', async () => {
      prisma.financeReceivable.findUnique
        .mockReset()
        .mockResolvedValueOnce({
          ...baseReceivable,
          order: {},
          receipts: [],
        })
        .mockResolvedValueOnce(baseReceivable);

      prisma.financeReceipt.findUnique.mockResolvedValue(null);
      prisma.financeReceipt.create.mockResolvedValue({});
      prisma.financeReceivable.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.receipt(1, {
          amount: 50,
          payMethod: '微信',
          payNo: 'WX002',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('voidReceivable', () => {
    it('不可作废状态时抛出异常', async () => {
      prisma.financeReceivable.findUnique.mockResolvedValue({
        ...baseReceivable,
        status: ReceivableStatus.PAID,
        order: {},
        receipts: [],
      });
      prisma.financeReceivable.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.voidReceivable(1, '测试'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findReceivableDetail', () => {
    it('不存在时抛出 NotFoundException', async () => {
      prisma.financeReceivable.findUnique.mockResolvedValue(null);

      await expect(service.findReceivableDetail(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

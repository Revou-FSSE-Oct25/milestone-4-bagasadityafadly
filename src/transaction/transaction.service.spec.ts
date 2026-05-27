import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockPrisma = {
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    jest.clearAllMocks();

    // Execute the prisma.$transaction callback immediately with the same mock
    mockPrisma.$transaction.mockImplementation((fn: (tx: any) => any) =>
      fn(mockPrisma),
    );
  });

  const userId = 'user-uuid-1';
  const otherUserId = 'user-uuid-2';
  const accountId = 'acc-uuid-1';
  const toAccountId = 'acc-uuid-2';

  const makeAccount = (overrides = {}) => ({
    id: accountId,
    accountNumber: 'ACC1234567890',
    balance: '400000',
    userId,
    isActive: true,
    accountType: 'SAVINGS',
    currency: 'IDR',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeTx = (overrides = {}) => ({
    id: 'tx-uuid-1',
    type: 'DEPOSIT',
    amount: '500000',
    balanceAfter: '900000',
    description: null,
    status: 'COMPLETED',
    createdAt: new Date(),
    fromAccountId: null,
    toAccountId: accountId,
    fromAccount: null,
    toAccount: makeAccount(),
    ...overrides,
  });

  // ─── deposit ───────────────────────────────────────────────────────────────

  describe('deposit', () => {
    it('should create a deposit transaction and update the balance', async () => {
      const account = makeAccount({ balance: '400000' });
      const tx = makeTx();

      mockPrisma.account.findUnique.mockResolvedValue(account);
      mockPrisma.transaction.create.mockResolvedValue(tx);
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.deposit(userId, {
        accountId,
        amount: 500000,
        description: 'Deposit',
      });

      expect(result).toEqual(tx);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { balance: 900000 },
      });
    });

    it('should correctly add decimal amounts to the balance', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount({ balance: '100.50' }));
      mockPrisma.transaction.create.mockResolvedValue(makeTx());
      mockPrisma.account.update.mockResolvedValue({});

      await service.deposit(userId, { accountId, amount: 50.25 });

      const updateCall = mockPrisma.account.update.mock.calls[0][0];
      expect(updateCall.data.balance).toBe(150.75);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.deposit(userId, { accountId: 'bad-id', amount: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if account belongs to another user', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ userId: otherUserId }),
      );

      await expect(
        service.deposit(userId, { accountId, amount: 1000 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if account is inactive', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ isActive: false }),
      );

      await expect(
        service.deposit(userId, { accountId, amount: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── withdraw ──────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('should create a withdrawal transaction and deduct the balance', async () => {
      const account = makeAccount({ balance: '400000' });
      const tx = makeTx({
        type: 'WITHDRAWAL',
        amount: '100000',
        balanceAfter: '300000',
        fromAccountId: accountId,
        toAccountId: null,
      });

      mockPrisma.account.findUnique.mockResolvedValue(account);
      mockPrisma.transaction.create.mockResolvedValue(tx);
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.withdraw(userId, {
        accountId,
        amount: 100000,
      });

      expect(result).toEqual(tx);
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { balance: 300000 },
      });
    });

    it('should throw BadRequestException when amount exceeds balance', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ balance: '50000' }),
      );

      await expect(
        service.withdraw(userId, { accountId, amount: 999999 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.withdraw(userId, { accountId, amount: 999999 }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw BadRequestException when withdrawing exactly more than balance', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ balance: '100' }),
      );

      await expect(
        service.withdraw(userId, { accountId, amount: 100.01 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.withdraw(userId, { accountId: 'bad-id', amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if account belongs to another user', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(
        makeAccount({ userId: otherUserId }),
      );

      await expect(
        service.withdraw(userId, { accountId, amount: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── transfer ──────────────────────────────────────────────────────────────

  describe('transfer', () => {
    const toAccount = makeAccount({
      id: toAccountId,
      accountNumber: 'ACC0987654321',
      balance: '0',
      userId: otherUserId,
    });

    it('should create a transfer and update both account balances', async () => {
      const tx = makeTx({
        type: 'TRANSFER',
        amount: '200000',
        balanceAfter: '200000',
        fromAccountId: accountId,
        toAccountId,
        fromAccount: makeAccount(),
        toAccount,
      });

      mockPrisma.account.findUnique
        .mockResolvedValueOnce(makeAccount({ balance: '400000' }))
        .mockResolvedValueOnce(toAccount);
      mockPrisma.transaction.create.mockResolvedValue(tx);
      mockPrisma.account.update.mockResolvedValue({});

      const result = await service.transfer(userId, {
        fromAccountId: accountId,
        toAccountId,
        amount: 200000,
      });

      expect(result).toEqual(tx);
      expect(mockPrisma.account.update).toHaveBeenCalledTimes(2);

      const calls = mockPrisma.account.update.mock.calls;
      const fromUpdate = calls.find((c) => c[0].where.id === accountId);
      const toUpdate = calls.find((c) => c[0].where.id === toAccountId);

      expect(fromUpdate[0].data.balance).toBe(200000);
      expect(toUpdate[0].data.balance).toBe(200000);
    });

    it('should throw BadRequestException when transferring to the same account', async () => {
      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId: accountId,
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId: accountId,
          amount: 1000,
        }),
      ).rejects.toThrow('Cannot transfer to the same account');
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(makeAccount({ balance: '100' }))
        .mockResolvedValueOnce(toAccount);

      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId,
          amount: 999999,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if source account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.transfer(userId, {
          fromAccountId: 'bad-id',
          toAccountId,
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if destination account does not exist', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(makeAccount())
        .mockResolvedValueOnce(null);

      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId: 'bad-id',
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if source account belongs to another user', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce(
        makeAccount({ userId: otherUserId }),
      );

      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId,
          amount: 100,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if destination account is inactive', async () => {
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(makeAccount())
        .mockResolvedValueOnce({ ...toAccount, isActive: false });

      await expect(
        service.transfer(userId, {
          fromAccountId: accountId,
          toAccountId,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all transactions linked to the users accounts', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: accountId }]);
      mockPrisma.transaction.findMany.mockResolvedValue([makeTx()]);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { fromAccountId: { in: [accountId] } },
              { toAccountId: { in: [accountId] } },
            ],
          },
        }),
      );
    });

    it('should return an empty array when the user has no transactions', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: accountId }]);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a transaction belonging to the user', async () => {
      const tx = makeTx();
      mockPrisma.account.findMany.mockResolvedValue([{ id: accountId }]);
      mockPrisma.transaction.findFirst.mockResolvedValue(tx);

      const result = await service.findOne(userId, 'tx-uuid-1');

      expect(result).toEqual(tx);
    });

    it('should throw NotFoundException if transaction does not belong to the user', async () => {
      mockPrisma.account.findMany.mockResolvedValue([{ id: accountId }]);
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'foreign-tx-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

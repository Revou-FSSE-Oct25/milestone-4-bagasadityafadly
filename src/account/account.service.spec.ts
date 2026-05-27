import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccountService', () => {
  let service: AccountService;

  const mockPrisma = {
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid-1';
  const otherUserId = 'user-uuid-2';
  const accountId = 'acc-uuid-1';

  const mockAccount = {
    id: accountId,
    accountNumber: 'ACC1234567890',
    accountType: 'SAVINGS',
    balance: '0',
    currency: 'IDR',
    isActive: true,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an account and generate an ACC account number', async () => {
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      await service.create(userId, { accountType: 'SAVINGS', currency: 'IDR' });

      const callArg = mockPrisma.account.create.mock.calls[0][0];
      expect(callArg.data.accountNumber).toMatch(/^ACC\d{10}$/);
      expect(callArg.data.userId).toBe(userId);
    });

    it('should default to SAVINGS type and IDR currency if not provided', async () => {
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      await service.create(userId, {});

      const callArg = mockPrisma.account.create.mock.calls[0][0];
      expect(callArg.data.accountType).toBe('SAVINGS');
      expect(callArg.data.currency).toBe('IDR');
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return only accounts belonging to the user', async () => {
      mockPrisma.account.findMany.mockResolvedValue([mockAccount]);

      const result = await service.findAll(userId);

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should return an empty array when user has no accounts', async () => {
      mockPrisma.account.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the account if it belongs to the user', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne(userId, accountId);

      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException if the account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if the account belongs to another user', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: otherUserId,
      });

      await expect(service.findOne(userId, accountId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the modified account', async () => {
      const updated = { ...mockAccount, accountType: 'CHECKING' };
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.account.update.mockResolvedValue(updated);

      const result = await service.update(userId, accountId, {
        accountType: 'CHECKING',
      });

      expect(result.accountType).toBe('CHECKING');
      expect(mockPrisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { accountType: 'CHECKING' },
      });
    });

    it('should throw NotFoundException when updating a non-existent account', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.update(userId, 'bad-id', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another users account', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: otherUserId,
      });

      await expect(
        service.update(userId, accountId, { isActive: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the account and return a success message', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.account.delete.mockResolvedValue(mockAccount);

      const result = await service.remove(userId, accountId);

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(mockPrisma.account.delete).toHaveBeenCalledWith({
        where: { id: accountId },
      });
    });

    it('should throw NotFoundException when deleting a non-existent account', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId, 'bad-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.account.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when deleting another users account', async () => {
      mockPrisma.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: otherUserId,
      });

      await expect(service.remove(userId, accountId)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.account.delete).not.toHaveBeenCalled();
    });
  });
});

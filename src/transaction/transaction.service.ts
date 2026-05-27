import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransferDto } from './dto/transfer.dto';
import { Account } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async getOwnedAccount(userId: string, accountId: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('Access to this account is forbidden');
    }

    if (!account.isActive) {
      throw new BadRequestException('Account is inactive');
    }

    return account;
  }

  private toNumber(value: unknown): number {
    return parseFloat(String(value));
  }

  private async getUserAccountIds(userId: string): Promise<string[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  // ─── Deposit ───────────────────────────────────────────────────────────────

  async deposit(userId: string, dto: DepositDto) {
    return this.prisma.$transaction(async (tx) => {
      const account = await this.getOwnedAccount(userId, dto.accountId);

      const currentBalance = this.toNumber(account.balance);
      const newBalance = parseFloat((currentBalance + dto.amount).toFixed(2));

      const [transaction] = await Promise.all([
        tx.transaction.create({
          data: {
            type: 'DEPOSIT',
            amount: dto.amount,
            balanceAfter: newBalance,
            description: dto.description ?? null,
            toAccountId: account.id,
          },
          include: { toAccount: true },
        }),
        tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        }),
      ]);

      return transaction;
    });
  }

  // ─── Withdraw ──────────────────────────────────────────────────────────────

  async withdraw(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      const account = await this.getOwnedAccount(userId, dto.accountId);

      const currentBalance = this.toNumber(account.balance);

      if (dto.amount > currentBalance) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = parseFloat((currentBalance - dto.amount).toFixed(2));

      const [transaction] = await Promise.all([
        tx.transaction.create({
          data: {
            type: 'WITHDRAWAL',
            amount: dto.amount,
            balanceAfter: newBalance,
            description: dto.description ?? null,
            fromAccountId: account.id,
          },
          include: { fromAccount: true },
        }),
        tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        }),
      ]);

      return transaction;
    });
  }

  // ─── Transfer ──────────────────────────────────────────────────────────────

  async transfer(userId: string, dto: TransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    return this.prisma.$transaction(async (tx) => {
      const fromAccount = await this.getOwnedAccount(userId, dto.fromAccountId);

      const toAccount = await this.prisma.account.findUnique({
        where: { id: dto.toAccountId },
      });

      if (!toAccount) {
        throw new NotFoundException(`Destination account ${dto.toAccountId} not found`);
      }

      if (!toAccount.isActive) {
        throw new BadRequestException('Destination account is inactive');
      }

      const fromBalance = this.toNumber(fromAccount.balance);

      if (dto.amount > fromBalance) {
        throw new BadRequestException('Insufficient balance');
      }

      const newFromBalance = parseFloat((fromBalance - dto.amount).toFixed(2));
      const newToBalance = parseFloat(
        (this.toNumber(toAccount.balance) + dto.amount).toFixed(2),
      );

      const description = dto.description ?? null;

      const [debitTx] = await Promise.all([
        tx.transaction.create({
          data: {
            type: 'TRANSFER',
            amount: dto.amount,
            balanceAfter: newFromBalance,
            description,
            fromAccountId: fromAccount.id,
            toAccountId: toAccount.id,
          },
          include: { fromAccount: true, toAccount: true },
        }),
        tx.account.update({
          where: { id: fromAccount.id },
          data: { balance: newFromBalance },
        }),
        tx.account.update({
          where: { id: toAccount.id },
          data: { balance: newToBalance },
        }),
      ]);

      return debitTx;
    });
  }

  // ─── List all transactions for the authenticated user ──────────────────────

  async findAll(userId: string) {
    const accountIds = await this.getUserAccountIds(userId);

    return this.prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: { in: accountIds } },
          { toAccountId: { in: accountIds } },
        ],
      },
      include: {
        fromAccount: true,
        toAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Get one transaction ───────────────────────────────────────────────────

  async findOne(userId: string, transactionId: string) {
    const accountIds = await this.getUserAccountIds(userId);

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        OR: [
          { fromAccountId: { in: accountIds } },
          { toAccountId: { in: accountIds } },
        ],
      },
      include: {
        fromAccount: true,
        toAccount: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}

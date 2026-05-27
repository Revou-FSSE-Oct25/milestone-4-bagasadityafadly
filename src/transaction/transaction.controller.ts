import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit funds into an account' })
  @ApiResponse({ status: 201, description: 'Deposit successful, returns transaction record' })
  @ApiResponse({ status: 400, description: 'Validation error or inactive account' })
  @ApiResponse({ status: 403, description: 'Account does not belong to the user' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  deposit(
    @CurrentUser() user: { id: string },
    @Body() dto: DepositDto,
  ) {
    return this.transactionService.deposit(user.id, dto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds from an account' })
  @ApiResponse({ status: 201, description: 'Withdrawal successful, returns transaction record' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or inactive account' })
  @ApiResponse({ status: 403, description: 'Account does not belong to the user' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  withdraw(
    @CurrentUser() user: { id: string },
    @Body() dto: WithdrawDto,
  ) {
    return this.transactionService.withdraw(user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer funds between two accounts' })
  @ApiResponse({ status: 201, description: 'Transfer successful, returns transaction record' })
  @ApiResponse({ status: 400, description: 'Insufficient balance, same account, or inactive account' })
  @ApiResponse({ status: 403, description: 'Source account does not belong to the user' })
  @ApiResponse({ status: 404, description: 'Source or destination account not found' })
  transfer(
    @CurrentUser() user: { id: string },
    @Body() dto: TransferDto,
  ) {
    return this.transactionService.transfer(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all transactions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns array of transactions (newest first)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.transactionService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one transaction by ID (must belong to the user)' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Returns transaction details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.transactionService.findOne(user.id, id);
  }
}

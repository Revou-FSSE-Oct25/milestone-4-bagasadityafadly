import { IsString, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ example: 'uuid-of-account' })
  @IsString()
  accountId: string;

  @ApiProperty({ example: 100000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'ATM withdrawal' })
  @IsOptional()
  @IsString()
  description?: string;
}

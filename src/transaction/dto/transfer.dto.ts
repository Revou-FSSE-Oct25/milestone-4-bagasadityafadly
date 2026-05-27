import { IsString, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({ example: 'uuid-of-source-account' })
  @IsString()
  fromAccountId: string;

  @ApiProperty({ example: 'uuid-of-destination-account' })
  @IsString()
  toAccountId: string;

  @ApiProperty({ example: 200000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Payment to Eve' })
  @IsOptional()
  @IsString()
  description?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class PaymentDto {
  @ApiProperty({ description: '本次付款金额', example: 400.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: '付款方式', example: '银行转账' })
  @IsString()
  @IsNotEmpty()
  payMethod: string;

  @ApiProperty({
    description: '付款流水号（幂等键，全局唯一）',
    example: 'TR202606250001',
  })
  @IsString()
  @IsNotEmpty()
  payNo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

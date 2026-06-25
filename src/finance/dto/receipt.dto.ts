import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class ReceiptDto {
  @ApiProperty({ description: '本次收款金额', example: 99.9 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: '收款方式', example: '微信支付' })
  @IsString()
  @IsNotEmpty()
  payMethod: string;

  @ApiProperty({
    description: '支付流水号（幂等键，全局唯一；现金可传 UUID）',
    example: 'WX202606250001',
  })
  @IsString()
  @IsNotEmpty()
  payNo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

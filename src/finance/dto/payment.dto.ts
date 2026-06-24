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

  @ApiProperty({ description: '付款流水号', required: false })
  @IsOptional()
  @IsString()
  payNo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

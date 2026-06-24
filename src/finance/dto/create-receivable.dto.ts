import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateReceivableDto {
  @ApiProperty({ description: '关联订单ID', example: 1 })
  @IsInt()
  orderId: number;

  @ApiProperty({ description: '应收总金额', example: 199.9 })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiProperty({ description: '客户名称', example: '张三' })
  @IsString()
  customerName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

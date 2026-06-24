import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreatePayableDto {
  @ApiProperty({ description: '关联采购单ID', example: 1 })
  @IsInt()
  purchaseOrderId: number;

  @ApiProperty({ description: '应付总金额', example: 850.0 })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiProperty({ description: '供应商名称', example: '义乌冰丝制品厂' })
  @IsString()
  supplierName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

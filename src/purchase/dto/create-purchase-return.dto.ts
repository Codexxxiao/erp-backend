import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReturnItemDto {
  @ApiProperty({ description: 'SKU ID', example: 1 })
  @IsInt()
  @Min(1)
  skuId: number;

  @ApiProperty({ description: '关联原采购明细ID', example: 1, required: false })
  @IsOptional()
  @IsInt()
  purchaseOrderItemId?: number;

  @ApiProperty({ description: '退货数量', example: 10 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '退货单价（原采购价）', example: 8.5 })
  @IsNumber()
  @Min(0.01)
  price: number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ description: '关联原采购单ID', example: 1, required: false })
  @IsOptional()
  @IsInt()
  purchaseOrderId?: number;

  @ApiProperty({ description: '供应商ID', example: 1 })
  @IsInt()
  supplierId: number;

  @ApiProperty({ description: '出库仓库ID', example: 1 })
  @IsInt()
  warehouseId: number;

  @ApiProperty({ description: '出库库位ID', example: 1 })
  @IsInt()
  locationId: number;

  @ApiProperty({ description: '退货明细', type: [ReturnItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

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

class PurchaseItemDto {
  @ApiProperty({ description: 'SKU ID', example: 1 })
  @IsInt()
  @Min(1)
  skuId: number;

  @ApiProperty({ description: '采购数量', example: 100 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: '采购单价', example: 8.5 })
  @IsNumber()
  @Min(0.01)
  price: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ description: '供应商ID', example: 1 })
  @IsInt()
  supplierId: number;

  @ApiProperty({ description: '入库仓库ID', example: 1 })
  @IsInt()
  warehouseId: number;

  @ApiProperty({ description: '入库库位ID', example: 1 })
  @IsInt()
  locationId: number;

  @ApiProperty({ description: '采购明细', type: [PurchaseItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

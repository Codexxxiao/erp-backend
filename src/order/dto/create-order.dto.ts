import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty({ description: 'SKU ID', example: 1 })
  @IsInt()
  @Min(1)
  skuId: number;

  @ApiProperty({ description: '购买数量', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '张三' })
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @ApiProperty({ example: '13800138000' })
  @IsString()
  @IsNotEmpty()
  receiverPhone: string;

  @ApiProperty({ example: '浙江省金华市义乌市' })
  @IsString()
  @IsNotEmpty()
  receiverAddress: string;

  @ApiProperty({ description: '发货仓库ID', example: 1 })
  @IsInt()
  warehouseId: number;

  @ApiProperty({ description: '出库库位ID', example: 1 })
  @IsInt()
  locationId: number;

  @ApiProperty({ description: '商品明细', type: [OrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ required: false })
  @IsString()
  remark?: string;
}

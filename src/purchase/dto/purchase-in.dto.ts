import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseInItemDto {
  @ApiProperty({ description: '采购明细ID', example: 1 })
  @IsInt()
  itemId: number;

  @ApiProperty({ description: '本次入库数量', example: 50 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class PurchaseInDto {
  @ApiProperty({ description: '入库明细', type: [PurchaseInItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PurchaseInItemDto)
  items: PurchaseInItemDto[];

  remark?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseReturnItemDto {
  @ApiProperty({ description: '采购明细ID', example: 1 })
  @IsInt()
  itemId: number;

  @ApiProperty({ description: '退货数量', example: 10 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class PurchaseReturnDto {
  @ApiProperty({ description: '退货明细', type: [PurchaseReturnItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnItemDto)
  items: PurchaseReturnItemDto[];

  @ApiProperty({ description: '退货原因', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

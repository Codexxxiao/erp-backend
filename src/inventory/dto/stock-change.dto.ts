import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, Min, IsOptional } from 'class-validator';

export class StockChangeDto {
  @ApiProperty({ description: 'SKU ID', example: 1 })
  @IsInt()
  skuId: number;

  @ApiProperty({ description: '库位ID', example: 1 })
  @IsInt()
  locationId: number;

  @ApiProperty({ description: '变动类型 IN/OUT', example: 'IN' })
  @IsString()
  @IsNotEmpty()
  type: 'IN' | 'OUT';

  @ApiProperty({ description: '变动数量', example: 100 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: '业务原因 PURCHASE/ORDER/ADJUST',
    example: 'ADJUST',
  })
  @IsString()
  reason: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

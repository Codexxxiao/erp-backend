import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreateSkuDto {
  @ApiProperty({ description: '所属SPU ID', example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ description: 'SKU编码', example: 'SKU-001' })
  @IsString()
  @IsNotEmpty()
  skuCode: string;

  @ApiProperty({ description: '规格名称', example: '黑色-均码' })
  @IsString()
  @IsNotEmpty()
  specName: string;

  @ApiProperty({ description: '销售价', example: 19.9 })
  @IsNumber()
  price: number;

  @ApiProperty({ description: '成本价', example: 8.5, required: false })
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiProperty({ description: '商品条码', required: false })
  @IsOptional()
  @IsString()
  barcode?: string;
}

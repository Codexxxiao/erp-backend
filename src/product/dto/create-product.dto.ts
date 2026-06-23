import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'SPU商品名称', example: '冰丝防晒面罩' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '分类ID', example: 1 })
  @IsInt()
  categoryId: number;

  @ApiProperty({ description: '品牌', example: '自主品牌', required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ description: '商品描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '主图地址', required: false })
  @IsOptional()
  @IsString()
  mainImage?: string;
}

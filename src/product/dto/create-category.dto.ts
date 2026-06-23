import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', example: '防晒配饰' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '父分类ID', example: 0, required: false })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ description: '排序号', example: 1, required: false })
  @IsOptional()
  @IsInt()
  sort?: number;
}

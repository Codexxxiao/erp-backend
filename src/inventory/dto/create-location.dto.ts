import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ description: '所属仓库ID', example: 1 })
  @IsInt()
  warehouseId: number;

  @ApiProperty({ description: '库位编码', example: 'A-01-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: '库位名称',
    example: 'A区1架1层',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '库位类型', example: 'NORMAL', required: false })
  @IsOptional()
  @IsString()
  type?: string;
}

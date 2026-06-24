import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ description: '供应商名称', example: '义乌冰丝制品厂' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '联系人', example: '王经理', required: false })
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiProperty({
    description: '联系电话',
    example: '13900001111',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: '供应商地址', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

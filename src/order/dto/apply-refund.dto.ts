import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ApplyRefundDto {
  @ApiProperty({ description: '售后原因', example: '商品质量问题退货' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FinishRefundDto {
  @ApiProperty({ description: '是否退货入库', example: true })
  @IsBoolean()
  isReturnGoods: boolean;

  @ApiProperty({ description: '处理备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmReceiveDto {
  @ApiProperty({ description: '收货备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

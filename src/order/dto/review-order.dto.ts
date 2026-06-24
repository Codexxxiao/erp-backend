import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewOrderDto {
  @ApiProperty({ description: '审核备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

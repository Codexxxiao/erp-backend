import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ShipOrderDto {
  @ApiProperty({ description: '物流公司', example: '中通快递' })
  @IsString()
  logisticsCompany: string;

  @ApiProperty({ description: '物流单号', example: '731000000000' })
  @IsString()
  trackingNo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

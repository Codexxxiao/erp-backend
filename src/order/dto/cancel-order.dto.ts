import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ description: '取消原因', example: '客户取消订单' })
  @IsString()
  @IsNotEmpty({ message: '取消原因不能为空' })
  reason: string;
}

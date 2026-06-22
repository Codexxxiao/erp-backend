import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({ description: '角色ID数组', type: [Number], example: [1] })
  @IsArray()
  @ArrayNotEmpty({ message: '角色ID不能为空' })
  roleIds: number[];
}

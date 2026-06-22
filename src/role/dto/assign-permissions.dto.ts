import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ example: [1, 2, 3], description: '权限 ID 列表' })
  @IsArray()
  @ArrayNotEmpty({ message: '权限 ID 列表不能为空' })
  @IsInt({ each: true, message: '每个权限 ID 必须是整数' })
  permissionIds: number[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'admin', description: '角色唯一标识' })
  @IsString()
  @IsNotEmpty({ message: '角色标识不能为空' })
  name: string;

  @ApiProperty({ example: '超级管理员', description: '角色显示名称' })
  @IsString()
  @IsNotEmpty({ message: '角色名称不能为空' })
  label: string;

  @ApiPropertyOptional({ example: '拥有全部权限' })
  @IsOptional()
  @IsString()
  description?: string;
}

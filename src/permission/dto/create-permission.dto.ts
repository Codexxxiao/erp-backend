import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'user:list', description: '权限唯一标识' })
  @IsString()
  @IsNotEmpty({ message: '权限码不能为空' })
  code: string;

  @ApiProperty({ example: '用户列表', description: '权限显示名称' })
  @IsString()
  @IsNotEmpty({ message: '权限名称不能为空' })
  label: string;

  @ApiPropertyOptional({
    example: 'menu',
    description: '权限类型：menu / button',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '查看用户列表' })
  @IsOptional()
  @IsString()
  description?: string;
}

import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, MinLength } from 'class-validator';
import { ApiTags, ApiProperty } from '@nestjs/swagger';

class LoginDto {
  @ApiProperty({ example: 'alice', description: '用户名' })
  @IsString({ message: '用户名必须是字符串' })
  username: string;

  @ApiProperty({ example: '123456', description: '密码' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度不能少于6位' })
  password: string;
}

@ApiTags('认证登录')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }
}

import { IsString, IsEmail, MinLength, IsOptional, minLength } from 'class-validator';
export class CreateUserDto {
    @IsString({ message: '用户名必须是字符串' })
    @MinLength(2, { message: '用户名长度不能少于2位' })
    username: string;
  
    @IsString({ message: '密码必须是字符串' })
    @MinLength(6, { message: '密码长度不能少于6位' })
    password: string;
  
    @IsEmail({}, { message: '邮箱格式不正确' })
    email: string;
  
    @IsOptional() // 可选字段
    @IsString()
    nickname?: string;
  }
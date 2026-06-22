import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // 登录：校验账号密码，签发token
  async login(username: string, password: string) {
    // 1. 查询用户
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 2. 比对密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. 签发JWT令牌，payload中存入用户标识
    const payload = { userId: user.id, username: user.username };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      userInfo: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }
}

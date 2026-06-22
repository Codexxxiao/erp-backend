import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // 从请求头提取 Bearer token
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      // 校验token并解析payload
      const payload = await this.jwtService.verifyAsync(token);
      // 将用户信息挂载到请求对象上，后续业务可直接取用
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    return true;
  }

  // 提取 Authorization: Bearer xxx 中的令牌
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  private readonly whitelist: string[];

  constructor(private readonly configService: ConfigService) {
    // 从环境变量读取白名单，逗号分隔
    const ipList = this.configService.get<string>('IP_WHITELIST') || '';
    this.whitelist = ipList
      .split(',')
      .filter(Boolean)
      .map((ip) => ip.trim());
  }

  use(req: Request, res: Response, next: NextFunction) {
    // 开发环境不校验，或白名单为空时不校验
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';
    if (isDev || this.whitelist.length === 0) {
      return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    // 处理 IPv6 映射的 IPv4 地址
    const realIp = clientIp?.replace('::ffff:', '');

    if (!realIp || !this.whitelist.includes(realIp)) {
      throw new ForbiddenException('当前IP无访问权限');
    }

    next();
  }
}

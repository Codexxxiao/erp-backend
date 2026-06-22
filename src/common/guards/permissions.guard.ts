import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserService } from '../../user/user.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPerms || requiredPerms.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('未获取到用户身份');
    }

    const user = await this.userService.findUserWithRolesAndPermissions(userId);
    if (!user) {
      throw new ForbiddenException('用户不存在');
    }

    // 超级管理员放行
    if (user.roles.some((role) => role.name === 'admin')) {
      return true;
    }

    // 收集用户所有角色下的所有权限码
    const userPermCodes = user.roles.flatMap((role) =>
      role.permissions.map((perm) => perm.code),
    );

    // 校验：拥有任意一个要求的权限即可通过
    const hasPerm = requiredPerms.some((perm) => userPermCodes.includes(perm));
    if (!hasPerm) {
      throw new ForbiddenException('无访问权限，权限不足');
    }

    return true;
  }
}

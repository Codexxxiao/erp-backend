import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserService } from '../../user/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 读取接口上标注的角色要求（支持方法级和类级）
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. 接口没标注角色要求，直接放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 3. 获取JWT守卫挂载的用户ID
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('未获取到用户身份');
    }

    // 4. 查询用户拥有的角色
    const user = await this.userService.findUserWithRolesAndPermissions(userId);
    if (!user) {
      throw new ForbiddenException('用户不存在');
    }

    const userRoleNames = user.roles.map((role) => role.name);

    // 5. 超级管理员默认拥有所有权限，直接放行
    if (userRoleNames.includes('admin')) {
      return true;
    }

    // 6. 校验：用户拥有任意一个要求的角色即可通过
    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('无访问权限，角色不足');
    }

    return true;
  }
}

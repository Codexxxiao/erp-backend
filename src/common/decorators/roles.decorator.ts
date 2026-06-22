import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 角色权限装饰器：标注接口需要的角色
 * 示例：@Roles('admin', 'editor')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

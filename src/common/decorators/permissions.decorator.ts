import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 细粒度权限装饰器：标注接口需要的权限码
 * 示例：@Permissions('user:list', 'user:add')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

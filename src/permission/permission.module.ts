import { Module, forwardRef } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UserModule)],
  controllers: [PermissionController],
  providers: [PermissionService, JwtGuard, RolesGuard, PermissionsGuard],
  exports: [PermissionService],
})
export class PermissionModule {}

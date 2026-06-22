import { Module, forwardRef } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UserModule)],
  controllers: [RoleController],
  providers: [RoleService, JwtGuard, RolesGuard, PermissionsGuard],
  exports: [RoleService],
})
export class RoleModule {}

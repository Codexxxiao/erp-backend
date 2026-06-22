import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('角色管理')
@ApiBearerAuth()
@Controller('role')
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Permissions('role:add')
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @Permissions('role:list')
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Permissions('role:list')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @Permissions('role:edit')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @Permissions('role:delete')
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }

  @Patch(':id/permissions')
  @Permissions('role:assign')
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.roleService.assignPermissions(+id, dto.permissionIds);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  create(createRoleDto: CreateRoleDto) {
    return this.prisma.role.create({
      data: createRoleDto,
    });
  }

  findAll() {
    return this.prisma.role.findMany({
      include: { permissions: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException(`ID为${id}的角色不存在`);
    }
    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    await this.findOne(id);
    return this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
      include: { permissions: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.role.delete({ where: { id } });
    return { message: '删除成功' };
  }

  async assignPermissions(roleId: number, permissionIds: number[]) {
    await this.findOne(roleId);
    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        permissions: {
          set: permissionIds.map((id) => ({ id })),
        },
      },
      include: { permissions: true },
    });
  }
}

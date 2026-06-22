import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPermissionDto: CreatePermissionDto) {
    return this.prisma.permission.create({
      data: createPermissionDto,
    });
  }

  findAll() {
    return this.prisma.permission.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`ID为${id}的权限不存在`);
    }
    return permission;
  }

  async update(id: number, updatePermissionDto: UpdatePermissionDto) {
    await this.findOne(id);
    return this.prisma.permission.update({
      where: { id },
      data: updatePermissionDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.permission.delete({ where: { id } });
    return { message: '删除成功' };
  }
}

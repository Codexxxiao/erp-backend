import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // 新增用户
  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  // 根据ID查询用户及其关联的角色、权限
  async findUserWithRolesAndPermissions(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });
  }

  // 给用户分配角色（覆盖式）
  async assignRoles(userId: number, roleIds: number[]) {
    await this.findOne(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          set: roleIds.map((id) => ({ id })),
        },
      },
      include: { roles: true },
    });
  }

  // 查询所有用户
  async findAll() {
    return this.prisma.user.findMany();
  }

  // 根据ID查询单个用户
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }
    return user;
  }

  // 更新用户
  async update(id: number, updateUserDto: UpdateUserDto) {
    const exist = await this.prisma.user.findUnique({ where: { id } });
    if (!exist) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  // 删除用户
  async remove(id: number) {
    const exist = await this.prisma.user.findUnique({ where: { id } });
    if (!exist) {
      throw new NotFoundException(`ID为${id}的用户不存在`);
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: '删除成功' };
  }

  // 分页查询用户
  async findPage(page: number, pageSize: number) {
    return this.prisma.user.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}

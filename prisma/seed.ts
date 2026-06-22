import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const permissions = [
  { code: 'user:list', label: '用户列表', type: 'button' },
  { code: 'user:add', label: '新增用户', type: 'button' },
  { code: 'user:edit', label: '编辑用户', type: 'button' },
  { code: 'user:delete', label: '删除用户', type: 'button' },
  { code: 'role:list', label: '角色列表', type: 'button' },
  { code: 'role:add', label: '新增角色', type: 'button' },
  { code: 'role:edit', label: '编辑角色', type: 'button' },
  { code: 'role:delete', label: '删除角色', type: 'button' },
  { code: 'role:assign', label: '分配角色权限', type: 'button' },
  { code: 'permission:list', label: '权限列表', type: 'button' },
  { code: 'permission:add', label: '新增权限', type: 'button' },
  { code: 'permission:edit', label: '编辑权限', type: 'button' },
  { code: 'permission:delete', label: '删除权限', type: 'button' },
];

async function main() {
  console.log('🚀 开始初始化 RBAC 种子数据...');

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { label: perm.label, type: perm.type },
      create: perm,
    });
  }
  console.log('✅ 基础权限初始化完成');

  const allPermissions = await prisma.permission.findMany();
  const permIds = allPermissions.map((p) => ({ id: p.id }));

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {
      label: '超级管理员',
      description: '系统最高权限，拥有所有操作权限',
      permissions: { set: permIds },
    },
    create: {
      name: 'admin',
      label: '超级管理员',
      description: '系统最高权限，拥有所有操作权限',
      permissions: { connect: permIds },
    },
  });
  console.log(`✅ 管理员角色初始化完成：${adminRole.name}`);

  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
      email: 'admin@example.com',
      nickname: '系统管理员',
      roles: { set: [{ id: adminRole.id }] },
    },
    create: {
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      nickname: '系统管理员',
      roles: { connect: [{ id: adminRole.id }] },
    },
  });
  console.log(`✅ 管理员账号初始化完成：${adminUser.username} / admin123`);

  console.log('\n🎉 RBAC 体系初始化全部完成');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { Permission, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ========== 按业务模块拆分权限，区分权限类型（menu:菜单 button:按钮 api:接口） ==========
const permissions = {
  // 系统管理模块
  system: [
    { code: 'system:user', label: '用户管理', type: 'menu' },
    { code: 'system:user:list', label: '用户列表', type: 'button' },
    { code: 'system:user:add', label: '新增用户', type: 'button' },
    { code: 'system:user:edit', label: '编辑用户', type: 'button' },
    { code: 'system:user:delete', label: '删除用户', type: 'button' },
    { code: 'system:user:import', label: '导入用户', type: 'button' }, // 新增扩展权限
    { code: 'system:role', label: '角色管理', type: 'menu' },
    { code: 'system:role:list', label: '角色列表', type: 'button' },
    { code: 'system:role:add', label: '新增角色', type: 'button' },
    { code: 'system:role:edit', label: '编辑角色', type: 'button' },
    { code: 'system:role:delete', label: '删除角色', type: 'button' },
    { code: 'system:role:assign', label: '分配角色权限', type: 'button' },
    { code: 'system:permission', label: '权限管理', type: 'menu' },
    { code: 'system:permission:list', label: '权限列表', type: 'button' },
    { code: 'system:permission:add', label: '新增权限', type: 'button' },
    { code: 'system:permission:edit', label: '编辑权限', type: 'button' },
    { code: 'system:permission:delete', label: '删除权限', type: 'button' },
    { code: 'system:dashboard', label: '控制台', type: 'menu' }, // 新增菜单权限
    { code: 'system:dashboard:view', label: '查看控制台', type: 'button' },
  ],
  // 商品管理模块（新增业务模块）
  product: [
    { code: 'product:list', label: '商品列表', type: 'menu' },
    { code: 'product:add', label: '新增商品', type: 'button' },
    { code: 'product:edit', label: '编辑商品', type: 'button' },
    { code: 'product:delete', label: '删除商品', type: 'button' },
    { code: 'product:audit', label: '审核商品', type: 'button' },
    { code: 'product:stock:edit', label: '编辑库存', type: 'button' },
    { code: 'api:product:list', label: '商品列表接口', type: 'api' }, // 接口类型权限
  ],
  // 订单管理模块（新增业务模块）
  order: [
    { code: 'order:list', label: '订单列表', type: 'menu' },
    { code: 'order:detail', label: '查看订单详情', type: 'button' },
    { code: 'order:refund', label: '订单退款', type: 'button' },
    { code: 'order:export', label: '导出订单', type: 'button' },
    { code: 'api:order:query', label: '订单查询接口', type: 'api' },
  ],
  // 财务模块（新增业务模块）
  finance: [
    { code: 'finance:reconciliation', label: '财务对账', type: 'menu' },
    {
      code: 'finance:reconciliation:view',
      label: '查看对账数据',
      type: 'button',
    },
    {
      code: 'finance:reconciliation:export',
      label: '导出对账报表',
      type: 'button',
    },
    { code: 'finance:payment', label: '支付管理', type: 'menu' },
    { code: 'finance:payment:audit', label: '审核支付单', type: 'button' },
  ],
};

// ========== 角色定义（新增运营/财务角色） ==========
const roles = [
  {
    name: 'admin',
    label: '超级管理员',
    description: '系统最高权限，拥有所有操作权限',
    // 超级管理员关联所有权限
    permissionFilter: () => true,
  },
  {
    name: 'operator',
    label: '运营人员',
    description: '负责商品、订单管理的运营角色',
    // 运营角色仅关联系统控制台、商品、订单相关权限
    permissionFilter: (perm: { code: string }) =>
      perm.code.startsWith('system:dashboard') ||
      perm.code.startsWith('product:') ||
      perm.code.startsWith('order:'),
  },
  {
    name: 'finance',
    label: '财务人员',
    description: '负责财务对账、支付审核的财务角色',
    // 财务角色仅关联系统控制台、财务相关权限
    permissionFilter: (perm: { code: string }) =>
      perm.code.startsWith('system:dashboard') ||
      perm.code.startsWith('finance:'),
  },
];

// ========== 用户定义（新增运营/财务账号） ==========
const users = [
  {
    username: 'admin',
    nickname: '系统管理员',
    email: 'admin@example.com',
    password: 'admin123',
    roleNames: ['admin'],
  },
  {
    username: 'operator',
    nickname: '运营专员',
    email: 'operator@example.com',
    password: 'operator123',
    roleNames: ['operator'],
  },
  {
    username: 'finance',
    nickname: '财务专员',
    email: 'finance@example.com',
    password: 'finance123',
    roleNames: ['finance'],
  },
];

/**
 * 初始化基础权限
 */
async function initPermissions() {
  console.log('🔧 开始初始化基础权限...');
  // 扁平化所有权限
  const allPermList = Object.values(permissions).flat();

  for (const perm of allPermList) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { label: perm.label, type: perm.type },
      create: perm,
    });
  }
  console.log('✅ 基础权限初始化完成（总计：', allPermList.length, '个）');

  // 返回所有权限数据，供角色关联使用
  return prisma.permission.findMany();
}

/**
 * 初始化角色并分配权限
 * @param allPermissions 所有权限列表
 */
async function initRoles(allPermissions: Permission[]) {
  console.log('\n🔧 开始初始化角色...');
  const roleMap = new Map<string, { id: number }>();

  for (const roleDef of roles) {
    // 筛选当前角色需要的权限ID
    const rolePermIds = allPermissions
      .filter(roleDef.permissionFilter)
      .map((p) => ({ id: p.id }));

    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        label: roleDef.label,
        description: roleDef.description,
        permissions: { set: rolePermIds },
      },
      create: {
        name: roleDef.name,
        label: roleDef.label,
        description: roleDef.description,
        permissions: { connect: rolePermIds },
      },
    });

    roleMap.set(role.name, { id: role.id });
    console.log(
      `✅ 角色初始化完成：${role.name}（分配${rolePermIds.length}个权限）`,
    );
  }

  return roleMap;
}

/**
 * 初始化用户并分配角色
 * @param roleMap 角色ID映射
 */
async function initUsers(roleMap: Map<string, { id: number }>) {
  console.log('\n🔧 开始初始化用户...');

  for (const userDef of users) {
    // 哈希密码
    const hashedPassword = await bcrypt.hash(userDef.password, 10);
    // 关联用户角色
    const userRoles = userDef.roleNames.map((roleName) => {
      const role = roleMap.get(roleName);
      if (!role)
        throw new Error(
          `角色${roleName}不存在，无法关联用户${userDef.username}`,
        );
      return { id: role.id };
    });

    const user = await prisma.user.upsert({
      where: { username: userDef.username },
      update: {
        password: hashedPassword,
        email: userDef.email,
        nickname: userDef.nickname,
        roles: { set: userRoles },
      },
      create: {
        username: userDef.username,
        password: hashedPassword,
        email: userDef.email,
        nickname: userDef.nickname,
        roles: { connect: userRoles },
      },
    });

    console.log(`✅ 用户初始化完成：${user.username} / ${userDef.password}`);
  }
}

/**
 * 主初始化流程
 */
async function main() {
  console.log('🚀 开始初始化 RBAC 种子数据...\n');

  try {
    // 1. 初始化权限
    const allPermissions = await initPermissions();
    // 2. 初始化角色（关联权限）
    const roleMap = await initRoles(allPermissions);
    // 3. 初始化用户（关联角色）
    await initUsers(roleMap);

    console.log('\n🎉 RBAC 体系初始化全部完成！');
  } catch (error) {
    console.error('❌ 初始化流程异常：', error);
    throw error; // 抛出错误让外层捕获
  }
}

// 执行主流程 + 错误处理 + 断开连接
main()
  .catch((e) => {
    console.error('\n❌ RBAC 初始化失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

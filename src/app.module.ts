import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './inventory/inventory.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import * as Joi from '@hapi/joi';
import { RequestLogMiddleware } from './common/middleware/request-log.middleware';
import { IpWhitelistMiddleware } from './common/middleware/ip-whitelist.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用，无需重复导入
      // 环境文件加载优先级：系统环境变量 > 指定环境文件 > 默认.env
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      // 启动时校验配置完整性
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        JWT_SECRET: Joi.string().required(), // 必填，缺失则启动失败
        JWT_EXPIRES_IN: Joi.string().default('2h'),
        DATABASE_URL: Joi.string().required(),
      }),
      validationOptions: {
        abortEarly: false, // 一次性列出所有错误，而非遇到第一个就终止
      },
    }),
    InventoryModule,
    UserModule,
    PrismaModule,
    AuthModule,
    RoleModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
    consumer.apply(IpWhitelistMiddleware).forRoutes('*');
  }
}

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
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { PurchaseModule } from './purchase/purchase.module';
import { FinanceModule } from './finance/finance.module';
import { StatsModule } from './stats/stats.module';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

const REDIS_KEY_PREFIX_BY_ENV: Record<string, string> = {
  development: 'erp:dev',
  test: 'erp:test',
  production: 'erp:prod',
};

function buildRedisUrl(configService: ConfigService): string {
  const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
  const port = configService.get<number>('REDIS_PORT') ?? 6379;
  const password = configService.get<string>('REDIS_PASSWORD');
  const db = configService.get<number>('REDIS_DB') ?? 0;
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  }
  return `redis://${host}:${port}/${db}`;
}

function resolveRedisKeyPrefix(configService: ConfigService): string {
  const explicit = configService.get<string>('REDIS_KEY_PREFIX');
  if (explicit) {
    return explicit;
  }
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  return REDIS_KEY_PREFIX_BY_ENV[nodeEnv] ?? 'erp';
}

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
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        REDIS_DB: Joi.number().default(0),
        REDIS_DEFAULT_TTL: Joi.number().default(300),
        REDIS_KEY_PREFIX: Joi.string().optional(),
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
    ProductModule,
    OrderModule,
    PurchaseModule,
    FinanceModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttlSeconds =
          configService.get<number>('REDIS_DEFAULT_TTL') || 300;
        const keyPrefix = resolveRedisKeyPrefix(configService);
        return {
          stores: [
            createKeyv(buildRedisUrl(configService), {
              namespace: keyPrefix,
            }),
          ],
          ttl: ttlSeconds * 1000,
        };
      },
    }),
    StatsModule,
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

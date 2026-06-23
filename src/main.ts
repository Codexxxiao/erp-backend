import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const env = configService.get<string>('NODE_ENV');

  // 限制 JSON 请求体大小，默认 100kb，这里调整为 1mb
  app.use(json({ limit: '1mb' }));
  // 限制表单提交大小，extended: true 支持嵌套对象
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // 全局 CORS 配置
  app.enableCors({
    // 允许的前端源，生产环境建议指定具体域名，不要用 *
    origin:
      configService.get<string>('NODE_ENV') === 'development'
        ? true // 开发环境允许所有源，方便调试
        : ['https://your-erp-frontend.com', 'http://localhost:5173'],
    credentials: true, // 允许携带 Cookie / Authorization 凭证
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 预检请求缓存时间，减少OPTIONS请求
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 过滤掉不在DTO中的属性
      forbidNonWhitelisted: true, // 如果请求中包含不在DTO中的属性，则抛出异常
      transform: true, // 将请求中的数据转换为DTO中的类型
    }),
  );

  // 全局统一响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('ERP 后端接口文档')
    .setDescription(`平台端 API - ${env} 环境`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  console.log(`✅ [${env}] 服务启动成功: http://localhost:${port}`);
  console.log(`📄 接口文档地址: http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

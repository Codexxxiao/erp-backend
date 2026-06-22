import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const env = configService.get<string>('NODE_ENV');

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
    .setDescription(`金飞平台端 API - ${env} 环境`)
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

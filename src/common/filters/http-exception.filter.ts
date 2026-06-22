import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器
 * 捕获所有异常，统一返回格式，隐藏敏感错误详情
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. 解析状态码
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. 解析错误信息
    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'string' ? res : (res as any).message || '请求失败';
      // 参数校验返回的是数组，拼接成字符串
      if (Array.isArray(message)) {
        message = message.join('；');
      }
    }

    // 3. 500错误打印完整日志，不暴露给前端
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url}`,
        exception instanceof Error
          ? exception.stack
          : JSON.stringify(exception),
      );
    }

    // 4. 返回统一格式的错误响应
    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}

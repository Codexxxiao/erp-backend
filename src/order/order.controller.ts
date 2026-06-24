import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ConfirmReceiveDto } from './dto/confirm-receive.dto';
import { ApplyRefundDto } from './dto/apply-refund.dto';
import { FinishRefundDto } from './dto/finish-refund.dto';
import { OrderStatus } from '@prisma/client';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('订单管理')
@ApiBearerAuth()
@Controller('order')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: '创建订单（自动扣库存）' })
  createOrder(@Body() dto: CreateOrderDto, @Request() req: any) {
    return this.orderService.createOrder(dto, req.user?.userId);
  }

  @Get()
  @ApiOperation({ summary: '分页查询订单列表' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  findList(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.findList(+page, +pageSize, status);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询订单详情' })
  findDetail(@Param('id') id: string) {
    return this.orderService.findDetail(+id);
  }

  // ========== 状态流转接口 ==========

  @Patch(':id/review')
  @ApiOperation({ summary: '审核通过（待审核→待发货）' })
  reviewOrder(
    @Param('id') id: string,
    @Body() dto: ReviewOrderDto,
    @Request() req: any,
  ) {
    return this.orderService.reviewOrder(+id, dto, req.user?.username, req.ip);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '取消订单（自动回滚库存）' })
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Request() req: any,
  ) {
    return this.orderService.cancelOrder(+id, dto, req.user?.username, req.ip);
  }

  @Patch(':id/ship')
  @ApiOperation({ summary: '订单发货' })
  shipOrder(
    @Param('id') id: string,
    @Body() dto: ShipOrderDto,
    @Request() req: any,
  ) {
    return this.orderService.shipOrder(+id, dto, req.user?.username, req.ip);
  }

  @Patch(':id/receive')
  @ApiOperation({ summary: '确认收货' })
  confirmReceive(
    @Param('id') id: string,
    @Body() dto: ConfirmReceiveDto,
    @Request() req: any,
  ) {
    return this.orderService.confirmReceive(
      +id,
      dto,
      req.user?.username,
      req.ip,
    );
  }

  @Post(':id/refund/apply')
  @ApiOperation({ summary: '发起售后' })
  applyRefund(
    @Param('id') id: string,
    @Body() dto: ApplyRefundDto,
    @Request() req: any,
  ) {
    return this.orderService.applyRefund(+id, dto, req.user?.username, req.ip);
  }

  @Post(':id/refund/finish')
  @ApiOperation({ summary: '完成售后（可选退货入库）' })
  finishRefund(
    @Param('id') id: string,
    @Body() dto: FinishRefundDto,
    @Request() req: any,
  ) {
    return this.orderService.finishRefund(+id, dto, req.user?.username, req.ip);
  }

  @Post(':id/refund/close')
  @ApiOperation({ summary: '关闭/驳回售后' })
  closeRefund(
    @Param('id') id: string,
    @Body('remark') remark?: string,
    @Request() req: any,
  ) {
    return this.orderService.closeRefund(
      +id,
      remark,
      req.user?.username,
      req.ip,
    );
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '查询订单操作日志' })
  getOrderLogs(@Param('id') id: string) {
    return this.orderService.getOrderLogs(+id);
  }
}

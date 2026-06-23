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

  @Patch(':id/ship')
  @ApiOperation({ summary: '订单发货' })
  shipOrder(@Param('id') id: string, @Body() dto: ShipOrderDto) {
    return this.orderService.shipOrder(+id, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { PayableService } from './payable.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { PaymentDto } from './dto/payment.dto';
import { PayableStatus } from '@prisma/client';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('财务-应付账款')
@ApiBearerAuth()
@Controller('finance/payable')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class PayableController {
  constructor(private readonly payableService: PayableService) {}

  @Post()
  @ApiOperation({ summary: '手动创建应付单' })
  createPayable(@Body() dto: CreatePayableDto, @Request() req: any) {
    return this.payableService.createPayable({
      ...dto,
      purchaseOrderNo: '',
      createdBy: req.user?.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: '分页查询应付单' })
  @ApiQuery({ name: 'status', required: false, enum: PayableStatus })
  @ApiQuery({ name: 'keyword', required: false })
  findList(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: PayableStatus,
    @Query('keyword') keyword?: string,
  ) {
    return this.payableService.findPayableList(
      +page,
      +pageSize,
      status,
      keyword,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '应付单详情（含付款记录）' })
  findDetail(@Param('id') id: string) {
    return this.payableService.findPayableDetail(+id);
  }

  @Post(':id/payment')
  @ApiOperation({ summary: '付款核销' })
  payment(
    @Param('id') id: string,
    @Body() dto: PaymentDto,
    @Request() req: any,
  ) {
    return this.payableService.payment(+id, dto, req.user?.username);
  }

  @Post(':id/void')
  @ApiOperation({ summary: '作废应付单' })
  voidPayable(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.payableService.voidPayable(+id, reason, req.user?.username);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: '查询付款记录明细' })
  getPayments(@Param('id') id: string) {
    return this.payableService.getPaymentsByPayableId(+id);
  }
}

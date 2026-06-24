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
import { FinanceService } from './finance.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { ReceiptDto } from './dto/receipt.dto';
import { ReceivableStatus } from '@prisma/client';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('财务-应收账款')
@ApiBearerAuth()
@Controller('finance/receivable')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post()
  @ApiOperation({ summary: '手动创建应收单' })
  createReceivable(@Body() dto: CreateReceivableDto, @Request() req: any) {
    return this.financeService.createReceivable({
      ...dto,
      orderNo: '', // 手动创建需自行补充，或后端查询订单填充
      createdBy: req.user?.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: '分页查询应收单' })
  @ApiQuery({ name: 'status', required: false, enum: ReceivableStatus })
  @ApiQuery({ name: 'keyword', required: false })
  findList(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: ReceivableStatus,
    @Query('keyword') keyword?: string,
  ) {
    return this.financeService.findReceivableList(
      +page,
      +pageSize,
      status,
      keyword,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '应收单详情（含收款记录）' })
  findDetail(@Param('id') id: string) {
    return this.financeService.findReceivableDetail(+id);
  }

  @Post(':id/receipt')
  @ApiOperation({ summary: '收款核销' })
  receipt(
    @Param('id') id: string,
    @Body() dto: ReceiptDto,
    @Request() req: any,
  ) {
    return this.financeService.receipt(+id, dto, req.user?.username);
  }

  @Post(':id/void')
  @ApiOperation({ summary: '作废应收单' })
  voidReceivable(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.financeService.voidReceivable(+id, reason, req.user?.username);
  }

  @Get(':id/receipts')
  @ApiOperation({ summary: '查询收款记录明细' })
  getReceipts(@Param('id') id: string) {
    return this.financeService.getReceiptsByReceivableId(+id);
  }
}

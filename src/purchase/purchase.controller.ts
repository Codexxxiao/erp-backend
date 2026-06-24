import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { PurchaseService } from './purchase.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseInDto } from './dto/purchase-in.dto';
import { PurchaseOrderStatus } from '@prisma/client';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('采购供应链')
@ApiBearerAuth()
@Controller('purchase')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  // ========== 供应商接口 ==========
  @Post('supplier')
  @ApiOperation({ summary: '新增供应商' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchaseService.createSupplier(dto);
  }

  @Get('supplier')
  @ApiOperation({ summary: '查询供应商列表' })
  @ApiQuery({ name: 'keyword', required: false })
  findAllSuppliers(@Query('keyword') keyword?: string) {
    return this.purchaseService.findAllSuppliers(keyword);
  }

  @Patch('supplier/:id')
  @ApiOperation({ summary: '更新供应商' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchaseService.updateSupplier(+id, dto);
  }

  @Delete('supplier/:id')
  @ApiOperation({ summary: '删除供应商' })
  removeSupplier(@Param('id') id: string) {
    return this.purchaseService.removeSupplier(+id);
  }

  // ========== 采购单接口 ==========
  @Post('order')
  @ApiOperation({ summary: '创建采购单' })
  createOrder(@Body() dto: CreatePurchaseDto, @Request() req: any) {
    return this.purchaseService.createPurchaseOrder(dto, req.user?.userId);
  }

  @Get('order')
  @ApiOperation({ summary: '分页查询采购单' })
  @ApiQuery({ name: 'status', required: false, enum: PurchaseOrderStatus })
  findOrderList(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('status') status?: PurchaseOrderStatus,
  ) {
    return this.purchaseService.findPurchaseList(+page, +pageSize, status);
  }

  @Get('order/:id')
  @ApiOperation({ summary: '采购单详情' })
  findOrderDetail(@Param('id') id: string) {
    return this.purchaseService.findPurchaseDetail(+id);
  }

  @Patch('order/:id/approve')
  @ApiOperation({ summary: '审核采购单' })
  approveOrder(@Param('id') id: string) {
    return this.purchaseService.approveOrder(+id);
  }

  @Patch('order/:id/cancel')
  @ApiOperation({ summary: '取消采购单' })
  cancelOrder(@Param('id') id: string) {
    return this.purchaseService.cancelOrder(+id);
  }

  @Post('order/:id/in')
  @ApiOperation({ summary: '采购入库（增加库存）' })
  purchaseIn(
    @Param('id') id: string,
    @Body() dto: PurchaseInDto,
    @Request() req: any,
  ) {
    return this.purchaseService.purchaseIn(+id, dto, req.user?.username);
  }
}

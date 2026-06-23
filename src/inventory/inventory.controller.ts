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
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { StockChangeDto } from './dto/stock-change.dto';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('库存仓储')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ========== 仓库接口 ==========
  @Post('warehouse')
  @ApiOperation({ summary: '新增仓库' })
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Get('warehouse')
  @ApiOperation({ summary: '查询所有仓库' })
  findAllWarehouses() {
    return this.inventoryService.findAllWarehouses();
  }

  @Patch('warehouse/:id')
  @ApiOperation({ summary: '更新仓库' })
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.inventoryService.updateWarehouse(+id, dto);
  }

  @Delete('warehouse/:id')
  @ApiOperation({ summary: '删除仓库' })
  removeWarehouse(@Param('id') id: string) {
    return this.inventoryService.removeWarehouse(+id);
  }

  // ========== 库位接口 ==========
  @Post('location')
  @ApiOperation({ summary: '新增库位' })
  createLocation(@Body() dto: CreateLocationDto) {
    return this.inventoryService.createLocation(dto);
  }

  @Get('location')
  @ApiOperation({ summary: '查询库位列表' })
  @ApiQuery({ name: 'warehouseId', required: false })
  findAllLocations(@Query('warehouseId') warehouseId?: string) {
    return this.inventoryService.findAllLocations(
      warehouseId ? +warehouseId : undefined,
    );
  }

  @Patch('location/:id')
  @ApiOperation({ summary: '更新库位' })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.inventoryService.updateLocation(+id, dto);
  }

  @Delete('location/:id')
  @ApiOperation({ summary: '删除库位' })
  removeLocation(@Param('id') id: string) {
    return this.inventoryService.removeLocation(+id);
  }

  // ========== 库存操作接口 ==========
  @Post('stock/change')
  @ApiOperation({ summary: '手动调整库存（入库/出库）' })
  manualChangeStock(@Body() dto: StockChangeDto, @Request() req: any) {
    return this.inventoryService.manualChangeStock(dto, req.user?.username);
  }

  @Get('stock')
  @ApiOperation({ summary: '查询库存余量列表' })
  @ApiQuery({ name: 'locationId', required: false })
  getStockList(@Query('locationId') locationId?: string) {
    return this.inventoryService.getStockList(
      locationId ? +locationId : undefined,
    );
  }

  @Get('stock/detail')
  @ApiOperation({ summary: '查询单个SKU库存' })
  getStock(
    @Query('skuId') skuId: string,
    @Query('locationId') locationId: string,
  ) {
    return this.inventoryService.getStock(+skuId, +locationId);
  }

  @Get('stock/logs')
  @ApiOperation({ summary: '查询库存流水' })
  @ApiQuery({ name: 'skuId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  getStockLogs(
    @Query('skuId') skuId?: string,
    @Query('locationId') locationId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.inventoryService.getStockLogs(
      skuId ? +skuId : undefined,
      locationId ? +locationId : undefined,
      +page,
      +pageSize,
    );
  }
}

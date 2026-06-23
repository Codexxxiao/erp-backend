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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('商品管理')
@ApiBearerAuth()
@Controller('product')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ========== 分类接口 ==========
  @Post('category')
  @ApiOperation({ summary: '新增商品分类' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productService.createCategory(dto);
  }

  @Get('category')
  @ApiOperation({ summary: '查询全部分类' })
  findAllCategories() {
    return this.productService.findAllCategories();
  }

  @Patch('category/:id')
  @ApiOperation({ summary: '更新分类' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.productService.updateCategory(+id, dto);
  }

  @Delete('category/:id')
  @ApiOperation({ summary: '删除分类' })
  removeCategory(@Param('id') id: string) {
    return this.productService.removeCategory(+id);
  }

  // ========== SPU商品接口 ==========
  @Post()
  @ApiOperation({ summary: '新增商品SPU' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询商品列表' })
  @ApiQuery({ name: 'keyword', required: false })
  findAllProducts(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
    @Query('keyword') keyword?: string,
  ) {
    return this.productService.findAllProducts(+page, +pageSize, keyword);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询商品详情' })
  findProduct(@Param('id') id: string) {
    return this.productService.findProduct(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新商品' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除商品' })
  removeProduct(@Param('id') id: string) {
    return this.productService.removeProduct(+id);
  }

  // ========== SKU接口 ==========
  @Post('sku')
  @ApiOperation({ summary: '新增SKU规格' })
  createSku(@Body() dto: CreateSkuDto) {
    return this.productService.createSku(dto);
  }

  @Get('sku/list')
  @ApiOperation({ summary: '查询SKU列表' })
  @ApiQuery({ name: 'productId', required: false })
  findAllSkus(@Query('productId') productId?: string) {
    return this.productService.findAllSkus(productId ? +productId : undefined);
  }

  @Get('sku/:id')
  @ApiOperation({ summary: '查询SKU详情' })
  findSku(@Param('id') id: string) {
    return this.productService.findSku(+id);
  }

  @Patch('sku/:id')
  @ApiOperation({ summary: '更新SKU' })
  updateSku(@Param('id') id: string, @Body() dto: UpdateSkuDto) {
    return this.productService.updateSku(+id, dto);
  }

  @Delete('sku/:id')
  @ApiOperation({ summary: '删除SKU' })
  removeSku(@Param('id') id: string) {
    return this.productService.removeSku(+id);
  }
}

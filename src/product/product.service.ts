import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== 分类管理 ==========
  createCategory(dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({ data: dto });
  }

  findAllCategories() {
    return this.prisma.productCategory.findMany({
      orderBy: { sort: 'asc' },
      include: { children: true },
    });
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const exist = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!exist) throw new NotFoundException('分类不存在');
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: number) {
    await this.prisma.productCategory
      .findUnique({ where: { id } })
      .catch(() => {
        throw new NotFoundException('分类不存在');
      });
    return this.prisma.productCategory.delete({ where: { id } });
  }

  // ========== SPU商品管理 ==========
  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  findAllProducts(page = 1, pageSize = 10, keyword?: string) {
    const where = keyword ? { name: { contains: keyword } } : {};
    return Promise.all([
      this.prisma.product.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: { category: true, skus: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]).then(([list, total]) => ({ list, total, page, pageSize }));
  }

  async findProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, skus: true },
    });
    if (!product) throw new NotFoundException('商品不存在');
    return product;
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    await this.findProduct(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async removeProduct(id: number) {
    await this.findProduct(id);
    return this.prisma.product.delete({ where: { id } });
  }

  // ========== SKU管理 ==========
  async createSku(dto: CreateSkuDto) {
    const exist = await this.prisma.sku.findUnique({
      where: { skuCode: dto.skuCode },
    });
    if (exist) throw new ConflictException('SKU编码已存在');
    return this.prisma.sku.create({ data: dto });
  }

  findAllSkus(productId?: number) {
    const where = productId ? { productId } : {};
    return this.prisma.sku.findMany({ where, include: { product: true } });
  }

  async findSku(id: number) {
    const sku = await this.prisma.sku.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!sku) throw new NotFoundException('SKU不存在');
    return sku;
  }

  async updateSku(id: number, dto: UpdateSkuDto) {
    await this.findSku(id);
    if (dto.skuCode) {
      const exist = await this.prisma.sku.findUnique({
        where: { skuCode: dto.skuCode },
      });
      if (exist && exist.id !== id)
        throw new ConflictException('SKU编码已存在');
    }
    return this.prisma.sku.update({ where: { id }, data: dto });
  }

  async removeSku(id: number) {
    await this.findSku(id);
    return this.prisma.sku.delete({ where: { id } });
  }
}

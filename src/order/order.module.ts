import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [InventoryModule, UserModule], // 导入库存模块，注入库存服务
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}

import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService], // 必须导出，供订单模块调用
})
export class InventoryModule {}

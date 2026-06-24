import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { UserModule } from '../user/user.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [InventoryModule, UserModule, FinanceModule],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}

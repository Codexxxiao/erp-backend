import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PayableService } from './payable.service';
import { PayableController } from './payable.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [FinanceController, PayableController],
  providers: [FinanceService, PayableService],
  exports: [FinanceService, PayableService], // 必须导出，供订单模块注入调用
})
export class FinanceModule {}

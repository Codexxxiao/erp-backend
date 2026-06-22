import { Injectable } from '@nestjs/common';

@Injectable()
export class InventoryService {
  // 这是你写的第一个业务方法：检查库存系统状态
  checkSystemStatus() {
    // 以后这里会写查数据库的代码，现在我们先 mock（模拟）一点假数据
    return {
      code: 200,
      message: 'ERP库存系统运转正常',
      data: {
        totalSkus: 8848,
        activeOrders: 128,
        pendingDispatch: 42, // 待打包发货数量
      },
    };
  }
}
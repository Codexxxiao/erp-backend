import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';

// '@Controller('inventory')' 定义了这组接口的基础路径是 /inventory
@Controller('inventory')
export class InventoryController {
  
  // 核心知识点：依赖注入 (DI)
  // 你只是在括号里声明了“我需要 InventoryService”，Nest 框架就会自动把它 new 好并喂给你！
  constructor(private readonly inventoryService: InventoryService) {}

  // '@Get('ping')' 拼接上基础路径，这个接口的完整路径就是 GET /inventory/ping
  @Get('ping')
  pingSystem() {
    // Controller 绝对不写业务逻辑，直接调用 Service 的方法，并把结果 return 给前端
    return this.inventoryService.checkSystemStatus();
  }
}
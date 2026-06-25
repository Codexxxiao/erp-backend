import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { STATS_OVERVIEW_CACHE_KEY } from '../common/constants/cache-keys';

@ApiTags('经营数据看板')
@ApiBearerAuth()
@Controller('stats')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: '经营总览看板数据' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: '开始日期 YYYY-MM-DD',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: '结束日期 YYYY-MM-DD',
  })
  @UseInterceptors(CacheInterceptor) // 启用自动缓存
  @CacheKey(STATS_OVERVIEW_CACHE_KEY)
  @CacheTTL(300_000) // 5 分钟（单位：毫秒）
  getOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.statsService.getOverview(startDate, endDate);
  }
}

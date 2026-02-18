import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'collector')
  @Get()
  findAll(
    @Query('status') status?: 'pending' | 'approved' | 'collected',
  ) {
    return this.reportsService.findAll(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/locations')
  getAnalyticsLocations() {
    return this.reportsService.getAnalyticsLocations();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'collector')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.reportsService.approve(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.reportsService.reject(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'collector')
  @Patch(':id/collect')
  collect(@Param('id') id: string) {
    return this.reportsService.collect(id);
  }
}

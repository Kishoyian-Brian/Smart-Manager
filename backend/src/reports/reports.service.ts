import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReportDto) {
    const id = `r${Date.now()}`;
    return this.prisma.report.create({
      data: {
        id,
        name: dto.name,
        location: dto.location,
        wasteType: dto.wasteType,
        fillLevel: dto.fillLevel,
        lat: dto.lat,
        lng: dto.lng,
        status: 'pending',
      },
    });
  }

  async findAll(status?: 'pending' | 'approved' | 'collected') {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async approve(id: string) {
    await this.findOne(id);
    return this.prisma.report.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date() },
    });
  }

  async reject(id: string) {
    await this.findOne(id);
    return this.prisma.report.delete({
      where: { id },
    });
  }

  async collect(id: string) {
    await this.findOne(id);
    return this.prisma.report.update({
      where: { id },
      data: { status: 'collected', collectedAt: new Date() },
    });
  }

  async getAnalyticsLocations() {
    const reports = await this.prisma.report.findMany({
      select: { location: true, lat: true, lng: true },
    });

    const byLocation = reports.reduce<
      Record<string, { count: number; lat?: number; lng?: number }>
    >((acc, r) => {
      const loc = r.location || 'Unknown';
      if (!acc[loc]) {
        acc[loc] = { count: 0, lat: r.lat ?? undefined, lng: r.lng ?? undefined };
      }
      acc[loc].count++;
      if (r.lat != null && r.lng != null && acc[loc].lat == null) {
        acc[loc].lat = r.lat;
        acc[loc].lng = r.lng;
      }
      return acc;
    }, {});

    return Object.entries(byLocation)
      .map(([location, data]) => ({
        location,
        count: data.count,
        lat: data.lat,
        lng: data.lng,
      }))
      .sort((a, b) => b.count - a.count);
  }
}

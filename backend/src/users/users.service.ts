import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollectors() {
    return this.prisma.user.findMany({
      where: { role: 'collector' },
      select: { id: true, username: true, createdAt: true },
      orderBy: { username: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException(`Username ${dto.username} already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        role: dto.role,
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });
  }

  async deleteByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
    await this.prisma.user.delete({
      where: { username },
    });
    return { message: `User ${username} deleted` };
  }
}

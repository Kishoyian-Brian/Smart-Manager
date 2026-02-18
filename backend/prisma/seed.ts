import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const adminHash = await bcrypt.hash('admin123', 10);
  const collectorHash = await bcrypt.hash('collector123', 10);

  // Default: Chuka Technical and Vocational College (MM77+2MR Chuka Technical College, Chuka)
  const defaultBase = {
    baseLat: -0.3345,
    baseLng: 37.6478,
    baseAddress: 'Chuka Technical and Vocational College, Chuka',
  };

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: defaultBase,
    create: {
      username: 'admin',
      passwordHash: adminHash,
      role: 'admin',
      ...defaultBase,
    },
  });

  await prisma.user.upsert({
    where: { username: 'collector' },
    update: defaultBase,
    create: {
      username: 'collector',
      passwordHash: collectorHash,
      role: 'collector',
      ...defaultBase,
    },
  });

  console.log('Seeded admin and collector users.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

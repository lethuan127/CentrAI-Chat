import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'Default', slug: 'default' },
  });

  const adminPassword = await argon2.hash('Admin123!');

  await prisma.user.upsert({
    where: { email: 'admin@centrai.local' },
    update: {},
    create: {
      email: 'admin@centrai.local',
      passwordHash: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
      authProvider: 'LOCAL',
      emailVerified: true,
      workspaceId: workspace.id,
    },
  });

  console.log('Seed complete: default workspace + admin user created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@democorp.com', 'bob@democorp.com', 'admin@gmail.com'] } },
    select: { email: true, role: true, status: true, tenantId: true },
  });
  console.log('Users found:', JSON.stringify(users, null, 2));
  
  // Also test the API endpoint
  const res = await fetch('http://localhost:4000/api/v1/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@democorp.com', password: 'admin123' }),
  }).catch(e => ({ ok: false, status: 0, error: e.message }));
  
  if ('error' in res) {
    console.log('\nBackend unreachable:', res.error);
    console.log('Make sure "npm run dev" is running in the monorepo root.');
  } else {
    const data = await (res as Response).json().catch(() => ({}));
    console.log('\nAPI response status:', (res as Response).status);
    console.log('API response body:', JSON.stringify(data));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

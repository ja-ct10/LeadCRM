#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    where: { tenantId: 'a3543600-e623-4774-ae21-da85f98081c2' },
    select: { id: true, email: true, firstName: true, lastName: true, tenantId: true }
  });
  
  console.log('\n👥 Users for Demo Sandbox tenant:\n');
  users.forEach(u => {
    console.log(`ID: ${u.id}`);
    console.log(`Name: ${u.firstName} ${u.lastName}`);
    console.log(`Email: ${u.email}`);
    console.log(`Tenant: ${u.tenantId}`);
    console.log('---');
  });
  
  await prisma.$disconnect();
}

listUsers();

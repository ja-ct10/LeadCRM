#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, email: true }
  });
  
  console.log('\n📋 Available Tenants:\n');
  tenants.forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`Name: ${t.name}`);
    console.log(`Slug: ${t.slug}`);
    console.log(`Email: ${t.email || 'N/A'}`);
    console.log('---');
  });
  
  await prisma.$disconnect();
}

listTenants();

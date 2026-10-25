'use strict';
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');

function compiledContext(env = process.env) {
  // Same compiled shared-package resolution as backend/start.js, without booting
  // a second scheduler or loading the TypeScript workspace entrypoint.
  const Module = require('node:module');
  const original = Module._resolveFilename;
  Module._resolveFilename = function(request,...args) {
    return request === '@leadcrm/shared' ? resolve(__dirname,'../dist/shared/src/index.js') : original.call(this,request,...args);
  };
  const { PrismaClient } = require('@prisma/client');
  const url = new URL(env.DIRECT_URL || env.DATABASE_URL);
  url.searchParams.set('application_name','leadcrm_crm_columns_operator');
  const db = new PrismaClient({datasources:{db:{url:url.href}},log:[]});
  return { db, PrismaClient, restoreResolver:() => { Module._resolveFilename=original; } };
}
async function withSession(db, work) {
  const { createAuthSessionToken } = require('../dist/backend/src/core/auth/auth-session.js');
  const { hashToken } = require('../dist/backend/src/core/auth/session.service.js');
  const marker = 'CRM column cutover ' + randomUUID();
  const users = await db.user.findMany({where:{role:'Client Admin',status:'ACTIVE',mustChangePassword:false,securityLockedAt:null,onboardingCompletedAt:{not:null}},select:{id:true,tenantId:true,role:true,email:true},orderBy:{createdAt:'asc'}});
  try {
    for (const user of users) {
      if (!await db.account.count({where:{tenantId:user.tenantId}})) continue;
      let token;
      try {
        token = await db.$transaction(async tx => {
          const value = await createAuthSessionToken(user,{userAgent:marker},tx);
          await tx.session.update({where:{tokenHash:hashToken(value)},data:{expiresAt:new Date(Date.now()+600000)}});
          return value;
        });
      } catch (error) { if (error.code === 'EMPLOYEE_ACCOUNT_REQUIRED') continue; throw error; }
      return await work(token,user);
    }
    throw Error('CRM_COLUMNS_ELIGIBLE_EXISTING_ADMIN_REQUIRED');
  } finally {
    const result = await db.session.updateMany({where:{userAgent:marker,revokedAt:null},data:{revokedAt:new Date()}});
    console.log('TEMPORARY_CRM_VERIFICATION_SESSION_REVOKED',result.count);
  }
}
module.exports = { compiledContext, withSession };
if (require.main === module) {
  require('dotenv').config({quiet:true});
  const mode = process.argv[2];
  if (!['--verify','--retire'].includes(mode)) throw Error('CRM_COLUMNS_INVALID_SESSION_MODE');
  const context = compiledContext();
  const operator = require('./deploy-crm-columns-retirement.cjs');
  (async () => {
    if (mode === '--retire' && (await operator.run(context.db,'--plan')).pending.length) await operator.writeFence(process.env,url => new context.PrismaClient({datasources:{db:{url}},log:[]}));
    return withSession(context.db,token => operator.run(context.db,mode,{...process.env,CRM_COLUMNS_VERIFY_TOKEN:token}));
  })().then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error('[crm-columns-session]',error.code||error.message,JSON.stringify(error.details||null));process.exitCode=1;})
    .finally(async()=>{await context.db.$disconnect();context.restoreResolver();});
}

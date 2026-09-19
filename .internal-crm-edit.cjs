const fs = require('fs');
const {execFileSync}=require('child_process');
const files=execFileSync('git',['-c','core.quotepath=false','diff','--name-only'],{encoding:'utf8'}).trim().split('\n');
const own = files.filter(p=> /^(backend\/src\/(api\/routes\/(admin|auth|billing)|api\/middleware\/(auth|tenant)|modules\/(system-admin\/tenants|administration\/(invitations|users|roles))|server)|frontend\/src\/features\/(system-admin|tenant\/(layout|settings|pages\/modern-login)))/.test(p));
for (const p of own) { if(fs.existsSync(p)) { const text=fs.readFileSync(p,'utf8'); fs.writeFileSync(p,text.replace(/[\t ]+\r?$/gm,'')); } }

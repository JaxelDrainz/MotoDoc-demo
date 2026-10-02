import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openDatabase, transaction } from './database.js';
import { passwordHash } from './app.js';
import { dataRoot, databasePath } from './config.js';

if(process.env.NODE_ENV==='production') throw new Error('Demo seeding is only available for local development.');
const db=openDatabase(databasePath),accounts=[];
for(const [role,name,email] of [['driver','Demo Driver','driver@motodoc.example'],['garage','Demo Mechanic','garage@motodoc.example']]) {
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) continue;
  const key=randomUUID(),password=randomBytes(18).toString('base64url'),encoded=await passwordHash(password);
  transaction(db,()=>{
    db.prepare('INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)').run(key,name,email,encoded,role);
    if(role==='driver') db.prepare('INSERT INTO vehicles VALUES(?,?,?,?,?,?,?)').run(randomUUID(),key,'Toyota','Corolla',2021,'DEMO-123',28000);
    else db.prepare('INSERT INTO garages(id,owner_id,name,city,address,description,services,published) VALUES(?,?,?,?,?,?,?,1)').run(randomUUID(),key,'MotoDoc Demo Garage','Tampere','Demo address','A fictional garage for trying the local MotoDoc booking flow.',JSON.stringify(['Oil change','Tyre change','Annual service']));
  });
  accounts.push({role,email,password});
}
if(accounts.length){await mkdir(dataRoot,{recursive:true});await writeFile(join(dataRoot,'demo-accounts.json'),JSON.stringify(accounts,null,2),{mode:0o600});console.log(`Demo accounts created. Local credentials: ${join(dataRoot,'demo-accounts.json')}`);}
else console.log('Demo accounts already exist; no data or passwords changed.');
db.close();

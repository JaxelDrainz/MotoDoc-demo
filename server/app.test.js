import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

async function fixture(t, options={}) {
  const dir=await mkdtemp(join(tmpdir(),'motodoc-test-'));
  const {app,db}=await createApp({databasePath:join(dir,'test.sqlite'),outboxPath:join(dir,'mailbox'),imageLookup:async()=>null,...options});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();await rm(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const client=()=>{
    let cookie='';
    return async(path,body,method=body===undefined?'GET':'POST',extra={})=>{
      const response=await fetch(base+path,{method,headers:{origin:'http://localhost:4173','X-MotoDoc-Request':'1','Content-Type':'application/json',cookie,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(response.headers.has('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
      return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
    };
  };
  return {db,dir,client,base};
}
const signup=(c,email,role='driver')=>c('/api/auth/signup',{name:role==='garage'?'Test Garage':'Test Driver',email,password:'testing-password-42',role});
const vehicle=c=>c('/api/vehicles',{make:'Toyota',model:'Corolla',year:2021,registration:'TEST-123',mileage:12000});
async function garage(c,email='garage@example.test') {
  await signup(c,email,'garage');
  await c('/api/garage/profile',{name:'Test Garage',city:'Tampere',address:'Test street 1',description:'Test fixture',services:['Oil change'],published:true},'PUT');
  return (await c('/api/garage/profile')).data;
}
const future=()=>{const d=new Date(Date.now()+86400000);d.setUTCMinutes(0,0,0);return d.toISOString();};

test('account persistence, password hashing, session rotation and logout',async t=>{
  const {client,db}=await fixture(t),c=client();
  assert.equal((await c('/api/vehicles')).status,401);
  const created=await signup(c,'  DRIVER@Example.test  ');
  assert.equal(created.status,201);assert.equal(created.data.user.email,'driver@example.test');
  assert.match(created.cookie,/HttpOnly/);assert.match(created.cookie,/SameSite=Strict/);
  const stored=db.prepare('SELECT * FROM users').get();
  assert.notEqual(stored.password_hash,'testing-password-42');assert(!JSON.stringify(created.data).includes('password'));
  assert.equal((await c('/api/auth/me')).status,200);
  assert.equal((await c('/api/auth/login',{email:'driver@example.test',password:'wrong'})).status,401);
  assert.equal((await c('/api/auth/login',{email:'driver@example.test',password:'testing-password-42'})).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  await c('/api/auth/logout',{});assert.equal((await c('/api/auth/me')).status,401);
  assert.equal((await signup(client(),'driver@example.test')).status,409);
});
test('cross-origin writes, invalid roles and unauthenticated access are rejected',async t=>{
  const {client}=await fixture(t),c=client();
  assert.equal((await c('/api/auth/signup',{},'POST',{origin:'https://evil.example'})).status,403);
  assert.equal((await c('/api/auth/signup',{},'POST',{'X-MotoDoc-Request':''})).status,403);
  assert.equal((await signup(c,'evil@example.test','admin')).status,400);
  await signup(c,'driver@example.test');
  assert.equal((await c('/api/garage/profile',{name:'mine'},'PUT')).status,403);
  assert.equal((await c('/api/auth/signup',{name:'x',email:'x@x.test',password:'short',role:'driver'})).status,400);
});
test('vehicle ownership and SQL injection resistance',async t=>{
  const {client,db}=await fixture(t),a=client(),b=client();await signup(a,'a@example.test');await signup(b,'b@example.test');
  const v=(await vehicle(a)).data;assert.equal((await b('/api/vehicles')).data.length,0);
  assert.equal((await b(`/api/vehicles/${v.id}`,{},'DELETE')).status,404);
  assert.equal((await a('/api/vehicles',{make:"'); DROP TABLE users; --",model:'Safe',year:2020,registration:'SAFE',mileage:0})).status,201);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,2);
});
test('booking lifecycle, unique slots, tenant isolation and atomic service history',async t=>{
  const {client}=await fixture(t),d=client(),g=client(),other=client();await signup(d,'d@example.test');const profile=await garage(g);await garage(other,'other@example.test');
  const v=(await vehicle(d)).data,body={garage_id:profile.id,vehicle_id:v.id,service:'Oil change',starts_at:future(),notes:''};
  const result=await d('/api/bookings',body);assert.equal(result.status,201);const key=result.data.id;
  assert.equal((await d('/api/bookings',body)).status,409);
  assert.equal((await other('/api/bookings')).data.length,0);
  assert.equal((await other(`/api/bookings/${key}`,{status:'confirmed'},'PATCH')).status,404);
  assert.equal((await d(`/api/bookings/${key}`,{status:'completed'},'PATCH')).status,403);
  assert.equal((await g(`/api/bookings/${key}`,{status:'confirmed'},'PATCH')).status,200);
  assert.equal((await g(`/api/bookings/${key}`,{status:'completed',summary:'Done',mileage:100},'PATCH')).status,400);
  assert.equal((await g('/api/bookings')).data[0].status,'confirmed');
  assert.equal((await g(`/api/bookings/${key}`,{status:'completed',summary:'Oil and filter replaced',mileage:13000},'PATCH')).status,200);
  assert.equal((await d('/api/service-history')).data[0].mileage,13000);
  assert.equal((await other('/api/service-history')).data.length,0);
  assert.equal((await d(`/api/vehicles/${v.id}`,{},'DELETE')).status,409);
  assert.equal((await g(`/api/bookings/${key}`,{status:'cancelled'},'PATCH')).status,409);
});
test('reset links expire, are single use, and revoke existing sessions',async t=>{
  let now=Date.now();const {client,dir}=await fixture(t,{clock:()=>now}),a=client(),b=client();await signup(a,'reset@example.test');
  const missing=await b('/api/auth/forgot-password',{email:'missing@example.test'});
  const found=await b('/api/auth/forgot-password',{email:'reset@example.test'});
  assert.deepEqual(missing.data,found.data);
  const files=await readdir(join(dir,'mailbox'));const mail=JSON.parse(await readFile(join(dir,'mailbox',files[0]),'utf8'));const token=new URLSearchParams(new URL(mail.url).hash.slice(1)).get('token');
  assert.equal((await b('/api/auth/reset-password',{token,password:'new-testing-password'})).status,200);
  assert.equal((await a('/api/auth/me')).status,401);
  assert.equal((await b('/api/auth/reset-password',{token,password:'other-password'})).status,400);
  assert.equal((await b('/api/auth/login',{email:'reset@example.test',password:'testing-password-42'})).status,401);
  assert.equal((await b('/api/auth/login',{email:'reset@example.test',password:'new-testing-password'})).status,200);
  await b('/api/auth/forgot-password',{email:'reset@example.test'});
  const latest=(await readdir(join(dir,'mailbox'))).filter(f=>f!==files[0])[0];const expiredToken=new URLSearchParams(new URL(JSON.parse(await readFile(join(dir,'mailbox',latest),'utf8')).url).hash.slice(1)).get('token');
  now+=31*60000;assert.equal((await b('/api/auth/reset-password',{token:expiredToken,password:'next-testing-password'})).status,400);
});
test('membership approval, private customer notes, invoices and reminders are scoped',async t=>{
  const {client}=await fixture(t),d=client(),g=client(),other=client();await signup(d,'member@example.test');const gp=await garage(g);await garage(other,'private@example.test');
  const plan=(await g('/api/plans',{name:'Care plan',benefits:'Priority booking',price_cents:1500})).data;
  assert.equal((await d('/api/memberships',{plan_id:plan.id})).status,201);const m=(await d('/api/memberships')).data[0];
  assert.equal(m.status,'requested');assert.equal((await d(`/api/memberships/${m.id}`,{status:'active'},'PATCH')).status,403);
  assert.equal((await g(`/api/memberships/${m.id}`,{status:'active'},'PATCH')).status,200);
  assert.equal((await other('/api/memberships')).data.length,0);
  const v=(await vehicle(d)).data;const b=(await d('/api/bookings',{garage_id:gp.id,vehicle_id:v.id,service:'Oil change',starts_at:future()})).data;
  await g(`/api/bookings/${b.id}`,{status:'confirmed'},'PATCH');await g(`/api/bookings/${b.id}`,{status:'completed',summary:'Done',mileage:13000},'PATCH');
  const customer=(await g('/api/customers')).data[0];await g(`/api/customers/${customer.id}`,{notes:'Private note',tags:'Regular'},'PUT');
  assert.equal((await other(`/api/customers/${customer.id}`,{notes:'Overwrite'},'PUT')).status,404);
  const invoice=await g('/api/invoices',{booking_id:b.id,description:'Oil change',amount_cents:9500,due_date:'2027-01-01'});assert.equal(invoice.status,201);
  assert.equal((await d('/api/invoices')).data[0].amount_cents,9500);assert.equal((await other('/api/invoices')).data.length,0);
  assert.equal((await d(`/api/invoices/${invoice.data.id}`,{status:'paid',payment_reference:'fake'},'PATCH')).status,403);
  assert.equal((await g(`/api/invoices/${invoice.data.id}`,{status:'paid',payment_reference:'Bank transfer test'},'PATCH')).status,200);
  assert.equal((await g('/api/overview')).data.invoiceTotals.paid,9500);
  const reminder=(await d('/api/reminders',{title:'Inspection',due_date:'2027-01-01'})).data;
  assert.equal((await other(`/api/reminders/${reminder.id}`,{done:true},'PATCH')).status,404);
});
test('repeated login attempts are throttled and session expiry is enforced',async t=>{
  let now=Date.now();const {client}=await fixture(t,{clock:()=>now}),c=client();await signup(c,'rate@example.test');
  now+=8*86400000;assert.equal((await c('/api/auth/me')).status,401);
  for(let i=0;i<20;i++) assert.equal((await c('/api/auth/login',{email:'rate@example.test',password:'incorrect'})).status,401);
  assert.equal((await c('/api/auth/login',{email:'rate@example.test',password:'incorrect'})).status,429);
});
test('google authentication handles new drivers, garages, account linking and unconfigured state',async t=>{
  // 1. Unconfigured state test
  const {client: unconfiguredClient}=await fixture(t);
  const u=unconfiguredClient();
  const unconfiguredRes = await u('/api/auth/google',{credential:'some-test-token',role:'driver'});
  assert.equal(unconfiguredRes.status,503);

  // 2. Mock verifier test
  const mockTokens = {
    'driver-token': { googleId:'google-sub-1', email:'googledriver@example.test', name:'Google Driver' },
    'garage-token': { googleId:'google-sub-2', email:'googlegarage@example.test', name:'Google Garage' },
    'existing-token': { googleId:'google-sub-3', email:'existing@example.test', name:'Existing Person' },
  };
  const mockVerifier = async(token) => {
    if (!mockTokens[token]) throw Object.assign(new Error('Invalid token'),{status:401});
    return mockTokens[token];
  };

  const {client,db}=await fixture(t,{googleClientId:'mock-client-id.apps.googleusercontent.com',verifyGoogleToken:mockVerifier});
  const c1=client(), c2=client(), c3=client();

  // New driver signup via Google
  const dRes = await c1('/api/auth/google',{credential:'driver-token',role:'driver'});
  assert.equal(dRes.status,200);
  assert.equal(dRes.data.user.email,'googledriver@example.test');
  assert.equal(dRes.data.user.role,'driver');
  assert.match(dRes.cookie,/HttpOnly/);
  // Can access authenticated routes
  assert.equal((await c1('/api/vehicles')).status,200);

  // New garage signup via Google
  const gRes = await c2('/api/auth/google',{credential:'garage-token',role:'garage'});
  assert.equal(gRes.status,200);
  assert.equal(gRes.data.user.role,'garage');
  // Garage record was auto-provisioned
  const garageProfile = await c2('/api/garage/profile');
  assert.equal(garageProfile.status,200);
  assert.match(garageProfile.data.name,/Google Garage/);

  // Existing password user must explicitly link Google while signed in.
  await signup(c3,'existing@example.test');
  const unlinked = await client()('/api/auth/google',{credential:'existing-token'});
  assert.equal(unlinked.status,409);
  const linkRes = await c3('/api/auth/link-google',{credential:'existing-token'});
  assert.equal(linkRes.status,200);
  const userRow = db.prepare('SELECT google_id FROM users WHERE email=?').get('existing@example.test');
  assert.equal(userRow.google_id,'google-sub-3');

  // OAuth users without password cannot be compromised by password login attempts
  const oauthOnly = client();
  assert.equal((await oauthOnly('/api/auth/login',{email:'googledriver@example.test',password:'any-guess'})).status,401);
});
test('vehicle condition, garage contact, booking messages and rescheduling are scoped',async t=>{
  const {client}=await fixture(t),d=client(),g=client(),stranger=client(),otherGarage=client();
  await signup(d,'d@example.test');await signup(stranger,'s@example.test');const profile=await garage(g);await garage(otherGarage,'other@example.test');
  assert.equal(profile.phone,'');
  const v=(await vehicle(d)).data;

  assert.equal((await d('/api/vehicles')).data[0].oil_life,null);
  assert.equal((await stranger(`/api/vehicles/${v.id}/condition`,{oil_life:1,brake_wear:1,mot_due:null},'PUT')).status,404);
  assert.equal((await d(`/api/vehicles/${v.id}/condition`,{oil_life:101,brake_wear:1,mot_due:null},'PUT')).status,400);
  assert.equal((await d(`/api/vehicles/${v.id}/condition`,{oil_life:84,brake_wear:72,mot_due:'2027-02-26'},'PUT')).status,200);
  assert.equal((await d(`/api/vehicles/${v.id}/condition`,{oil_life:80,brake_wear:null,mot_due:'2027-02-26'},'PUT')).status,200);
  const stored=(await d('/api/vehicles')).data[0];
  assert.deepEqual([stored.oil_life,stored.brake_wear,stored.mot_due],[80,null,'2027-02-26']);

  assert.equal((await d('/api/garage/contact',{phone:'1',opening_hours:'',mechanic_name:''},'PUT')).status,403);
  assert.equal((await g('/api/garage/contact',{phone:'call me',opening_hours:'',mechanic_name:''},'PUT')).status,400);
  assert.equal((await g('/api/garage/contact',{phone:'+358 40 123 4567',opening_hours:'Mon-Fri 08:00-17:00',mechanic_name:'Test Mechanic'},'PUT')).status,200);
  assert.equal((await g('/api/garage/profile')).data.mechanic_name,'Test Mechanic');

  const first=future(),key=(await d('/api/bookings',{garage_id:profile.id,vehicle_id:v.id,service:'Oil change',starts_at:first,notes:''})).data.id;
  const booked=(await d('/api/bookings')).data[0];
  assert.deepEqual([booked.phone,booked.opening_hours,booked.mechanic_name,booked.garage_city],['+358 40 123 4567','Mon-Fri 08:00-17:00','Test Mechanic','Tampere']);

  assert.equal((await d(`/api/bookings/${key}/messages`,{body:'Can I wait on site?'})).status,201);
  assert.equal((await g(`/api/bookings/${key}/messages`,{body:'Yes, about an hour.'})).status,201);
  assert.equal((await stranger(`/api/bookings/${key}/messages`,{body:'x'})).status,404);
  assert.equal((await otherGarage(`/api/bookings/${key}/messages`,{body:'x'})).status,404);
  assert.equal((await d(`/api/bookings/${key}/messages`,{body:'   '})).status,400);
  const thread=(await g('/api/messages')).data;
  assert.deepEqual(thread.map(m=>[m.sender_name,m.body]),[['Test Driver','Can I wait on site?'],['Test Garage','Yes, about an hour.']]);
  assert.equal((await d('/api/messages')).data.length,2);
  assert.equal((await stranger('/api/messages')).data.length,0);
  assert.equal((await otherGarage('/api/messages')).data.length,0);

  await g(`/api/bookings/${key}`,{status:'confirmed'},'PATCH');
  const later=new Date(Date.parse(first)+2*3600000).toISOString();
  assert.equal((await g(`/api/bookings/${key}/schedule`,{starts_at:later},'PUT')).status,403);
  assert.equal((await stranger(`/api/bookings/${key}/schedule`,{starts_at:later},'PUT')).status,404);
  assert.equal((await d(`/api/bookings/${key}/schedule`,{starts_at:new Date(Date.parse(first)+1800000).toISOString()},'PUT')).status,400);
  assert.equal((await d(`/api/bookings/${key}/schedule`,{starts_at:later},'PUT')).status,200);
  const moved=(await d('/api/bookings')).data[0];
  assert.deepEqual([moved.starts_at,moved.status],[later,'pending']);
  // The freed slot can be taken, and then cannot be moved back onto.
  const v2=(await stranger('/api/vehicles',{make:'Volvo',model:'XC60',year:2022,registration:'TWO-222',mileage:5})).data;
  assert.equal((await stranger('/api/bookings',{garage_id:profile.id,vehicle_id:v2.id,service:'Oil change',starts_at:first,notes:''})).status,201);
  assert.equal((await d(`/api/bookings/${key}/schedule`,{starts_at:first},'PUT')).status,409);
  await d(`/api/bookings/${key}`,{status:'cancelled'},'PATCH');
  assert.equal((await d(`/api/bookings/${key}/schedule`,{starts_at:later},'PUT')).status,409);
});
test('reviews need a completed booking and feed the garage rating',async t=>{
  const {client}=await fixture(t),d=client(),other=client(),g=client();
  await signup(d,'d@example.test');await signup(other,'o@example.test');const profile=await garage(g);
  const v=(await vehicle(d)).data,key=(await d('/api/bookings',{garage_id:profile.id,vehicle_id:v.id,service:'Oil change',starts_at:future(),notes:''})).data.id;
  assert.equal((await d(`/api/bookings/${key}/review`,{rating:5},'PUT')).status,404);
  await g(`/api/bookings/${key}`,{status:'confirmed'},'PATCH');
  await g(`/api/bookings/${key}`,{status:'completed',summary:'Done',mileage:12500},'PATCH');
  assert.equal((await other(`/api/bookings/${key}/review`,{rating:1},'PUT')).status,404);
  assert.equal((await g(`/api/bookings/${key}/review`,{rating:5},'PUT')).status,403);
  assert.equal((await d(`/api/bookings/${key}/review`,{rating:6},'PUT')).status,400);
  assert.equal((await d(`/api/bookings/${key}/review`,{rating:5},'PUT')).status,200);
  assert.equal((await d(`/api/bookings/${key}/review`,{rating:4},'PUT')).status,200);
  const listed=(await other('/api/garages')).data[0];
  assert.deepEqual([listed.rating,listed.review_count],[4,1]);
  const booked=(await d('/api/bookings')).data[0];
  assert.deepEqual([booked.rating,booked.review_count],[4,1]);
  assert.equal((await d('/api/service-history')).data[0].rating,4);
});
test('vehicle catalogue searches bundled data first, falls back to the lookup, and serves illustrations',async t=>{
  const asked=[];
  const vehicleLookup={makes:async q=>{asked.push(`makes:${q}`);return ['Zenvo','Zenvo'];},models:async(make,q)=>{asked.push(`models:${make}:${q}`);if(make==='Broken')throw new Error('offline');return ['TS1 GT','ST1'];}};
  const photos=[],imageLookup=async(make,model)=>{photos.push(`${make} ${model}`);if(make==='Zenvo')throw new Error('offline');return model==='XC60'?{image_url:'https://upload.example/xc60.jpg',image_source:'https://commons.example/xc60',image_credit:'A. Photographer',image_license:'CC BY-SA 4.0'}:null;};
  const {client,base}=await fixture(t,{vehicleLookup,imageLookup}),c=client();
  assert.equal((await c('/api/catalog/makes?q=vol')).status,401);
  await signup(c,'d@example.test');
  assert.deepEqual((await c('/api/catalog/makes?q=vol')).data,['Volkswagen','Volvo']);
  assert((await c('/api/catalog/makes')).data.length>50);
  assert.deepEqual((await c('/api/catalog/makes?q=skoda')).data,['Škoda']);
  assert.deepEqual((await c('/api/catalog/models?make=volvo&q=xc')).data,['XC40','XC60','XC70','XC90']);
  assert.deepEqual((await c('/api/catalog/models?q=xc')).data,[]);
  assert.deepEqual(asked,[]);
  assert.deepEqual((await c('/api/catalog/makes?q=zenv')).data,['Zenvo']);
  assert.deepEqual((await c('/api/catalog/models?make=Zenvo&q=')).data,['ST1','TS1 GT']);
  assert.deepEqual((await c('/api/catalog/models?make=Broken')).data,[]);
  assert.deepEqual(asked,['makes:zenv','models:Zenvo:','models:Broken:']);

  await c('/api/vehicles',{make:'Volvo',model:'XC60 Recharge T8',year:2023,registration:'ABC-123',mileage:1});
  await c('/api/vehicles',{make:'Zenvo',model:'ST1',year:2023,registration:'ZEN-1',mileage:1});
  assert.deepEqual((await c('/api/vehicles')).data.map(v=>v.body),['suv',null]);
  // Trim levels share the model's photo; a found photo and "none found" are cached, a failed lookup is retried.
  await c('/api/vehicles',{make:'Volvo',model:'V60',year:2020,registration:'V-60',mileage:1});
  const listed=(await c('/api/vehicles')).data;
  assert.deepEqual(listed.map(v=>v.image_url),[null,'https://upload.example/xc60.jpg',null]);
  assert.deepEqual([listed[1].image_credit,listed[1].image_license],['A. Photographer','CC BY-SA 4.0']);
  const preview=(await c('/api/catalog/image?make=Volvo&model=XC60')).data;
  assert.deepEqual([preview.image_url,preview.body],['https://upload.example/xc60.jpg','suv']);
  assert.equal((await c('/api/catalog/image?make=Volvo')).status,400);
  await c('/api/vehicles');
  assert.deepEqual(photos,['Volvo XC60','Zenvo ST1','Volvo V60','Zenvo ST1','Zenvo ST1']);

  const art=await fetch(`${base}/api/catalog/art/suv.svg`);
  assert.equal(art.status,200);assert.match(art.headers.get('content-type'),/image\/svg\+xml/);assert.match(await art.text(),/^<svg /);
  assert.equal((await fetch(`${base}/api/catalog/art/spaceship.svg`)).status,404);
});

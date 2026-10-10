const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SUPABASE_URL='https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='mock';
process.env.AUTH_SECRET='mock-secret';
process.env.RESEND_API_KEY='mock';
process.env.AUTH_EMAIL_FROM='support@example.com';
const auth=require('../src/auth');
const reset=require('../src/passwordReset');
let user={id:crypto.randomUUID(),email:'reset@example.com',password_hash:auth._internal.hashPassword('old-password'),created_at:new Date().toISOString()};
const messages=[];
global.fetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.hostname==='api.resend.com'){messages.push(JSON.parse(options.body));return new Response('{}',{status:200});}
 if(u.pathname.endsWith('/atr_users')){
  let rows=user && (!u.searchParams.has('email') || u.searchParams.get('email')==='eq.'+user.email) ? [user] : [];
  if(options.method==='PATCH'){
   if(u.searchParams.get('id')!=='eq.'+user.id || u.searchParams.get('password_hash')!=='eq.'+user.password_hash) rows=[];
   else {user={...user,...JSON.parse(options.body)}; rows=[user];}
  }
  return Response.json(rows);
 }
 return new Response('',{status:200,headers:{'content-range':'*/0'}});
};
(async()=>{
 const cfg=auth._internal.config();
 const old=auth._internal.signToken(user,cfg);
 const known=await reset.forgotPassword({email:user.email},'test');
 const unknown=await reset.forgotPassword({email:'unknown@example.com'},'test');
 assert.deepEqual(known,unknown);assert.equal(messages.length,1);
 const token=messages[0].text.split('#reset-password=')[1].split('\n')[0];
 assert.equal(auth._internal.readToken(token),null);
 await assert.rejects(reset.resetPassword({token:token+'bad',password:'new-password'}),e=>e.statusCode===400);
 await assert.rejects(reset.resetPassword({token,password:'short'}),e=>e.statusCode===400);
 const [body]=token.split('.');const expired=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url')),exp:Date.now()-1000})).toString('base64url');
 const sig=crypto.createHmac('sha256',cfg.secret).update(`password-reset:${user.password_hash}:${expired}`).digest('base64url');
 await assert.rejects(reset.resetPassword({token:expired+'.'+sig,password:'new-password'}),e=>e.statusCode===400);
 const results=await Promise.allSettled([reset.resetPassword({token,password:'new-password'}),reset.resetPassword({token,password:'new-password'})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(reset.resetPassword({token,password:'another-password'}),e=>e.statusCode===400);
 assert.equal(auth._internal.verifyPassword('old-password',user.password_hash),false);
 assert.equal(auth._internal.verifyPassword('new-password',user.password_hash),true);
 await assert.rejects(auth.resolveSession({headers:{authorization:'Bearer '+old}}),e=>e.statusCode===401);
 const login=await auth.signIn({email:user.email,password:'new-password'});assert.ok((await auth.resolveSession({headers:{authorization:'Bearer '+login.token}})).user);
 await assert.rejects(reset.forgotPassword({email:user.email},'test'),e=>e.statusCode===429);
 delete process.env.RESEND_API_KEY;
 await assert.rejects(reset.forgotPassword({email:user.email}),e=>e.statusCode===503);
 console.log('PASS: recovery, enumeration response, tampering, weak password, expiry, concurrent single use, replay, old-password/session revocation, new login, rate limiting, missing mail config');
})().catch(e=>{console.error(e);process.exitCode=1;});

import { createApp } from './app.js';
import express from 'express';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { databasePath, outboxPath } from './config.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.API_PORT || 4174);
const {app,db} = await createApp({databasePath,outboxPath,appOrigin:process.env.APP_ORIGIN || 'http://localhost:4173',production});
if(production) {
  // The Next.js driver dashboard runs as its own process; serve it on this origin so it shares the session and API.
  const dashboard=process.env.DASHBOARD_URL && new URL(process.env.DASHBOARD_URL);
  if(dashboard) app.use('/dashboard',(req,res)=>{
    const upstream=request({protocol:dashboard.protocol,hostname:dashboard.hostname,port:dashboard.port,path:req.originalUrl,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
    upstream.on('error',()=>{if(!res.headersSent)res.status(502).send('The MotoDoc dashboard is unavailable.');else res.end();});
    req.pipe(upstream);
  });
  app.use(express.static(resolve('dist/client'),{index:false}));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/client/index.html')));
}
const server=app.listen(port,process.env.API_HOST || '127.0.0.1',()=>console.log(`MotoDoc API listening on http://127.0.0.1:${port}`));
const shutdown=()=>server.close(()=>{db.close();process.exit(0);});
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

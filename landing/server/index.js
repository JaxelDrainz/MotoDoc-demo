import { createApp } from './app.js';
import express from 'express';
import { resolve } from 'node:path';
import { databasePath, outboxPath } from './config.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.API_PORT || 4174);
const {app,db} = await createApp({databasePath,outboxPath,appOrigin:process.env.APP_ORIGIN || 'http://localhost:4173',production});
if(production) {
  // The driver dashboard is built to static files and copied here by the root build (see ../package.json).
  app.use('/dashboard',express.static(resolve('dist/client/dashboard')));
  app.use(express.static(resolve('dist/client'),{index:false}));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/client/index.html')));
}
const server=app.listen(port,process.env.API_HOST || '127.0.0.1',()=>console.log(`MotoDoc API listening on http://127.0.0.1:${port}`));
const shutdown=()=>server.close(()=>{db.close();process.exit(0);});
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

import { beforeEach,afterEach,describe,it,expect } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { createGateway } from '../src/app';
let servers:Server[]=[];
async function fakeService(name:string) {
  const app=express();app.use(express.json());
  app.post('/internal/sessions/verify',(req,res)=>{if(req.headers.cookie==='short_session=valid')res.json({user:{id:'verified'}});else res.status(401).json({error:{code:'UNAUTHORIZED'}});});
  app.get('/s/:code',(_req,res)=>res.setHeader('Cache-Control','no-store').redirect(302,'https://example.com/a?x=1#part'));
  app.get('/:code',(_req,res)=>res.setHeader('Cache-Control','no-store').redirect(302,'https://example.com/a?x=1#part'));
  app.use((req,res)=>{res.setHeader('Set-Cookie','session=test; HttpOnly');res.json({service:name,path:req.originalUrl,cookie:req.headers.cookie,key:req.get('x-internal-key'),userId:req.get('x-user-id'),forwarded:req.get('x-forwarded-for'),requestId:req.get('x-request-id'),body:req.body});});
  const server=await new Promise<Server>(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});servers.push(server);
  const address=server.address();if(!address || typeof address==='string')throw new Error('Missing port');return 'http://127.0.0.1:'+address.port;
}
beforeEach(async()=>{process.env.AUTH_SERVICE_URL=await fakeService('auth');process.env.LINK_SERVICE_URL=await fakeService('links');process.env.ANALYTICS_SERVICE_URL=await fakeService('analytics');});
afterEach(async()=>{await Promise.all(servers.map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))));servers=[];});
describe('Gateway real HTTP proxy',()=>{
  it('routes stats before links and preserves query/cookies',async()=>{const app=createGateway();const response=await request(app).get('/api/links/abc/stats?from=2026-10-01').set('Cookie','short_session=valid');expect(response.status).toBe(200);expect(response.body.service).toBe('analytics');expect(response.body.path).toBe('/api/links/abc/stats?from=2026-10-01');expect(response.body.cookie).toBe('short_session=valid');expect(response.headers['set-cookie'][0]).toContain('HttpOnly');});
  it('routes auth, links and general stats',async()=>{for(const [path,service] of [['/api/auth/me','auth'],['/api/links','links'],['/api/stats','analytics']]) {const response=await request(createGateway()).get(path).set('Cookie','short_session=valid');expect(response.body.service).toBe(service);}});
  it('strips spoofed identity and forwarding headers',async()=>{const response=await request(createGateway()).get('/api/links').set('Cookie','short_session=valid').set('X-User-Id','victim').set('X-Internal-Key','attacker').set('X-Forwarded-For','fake').set('X-Request-Id','spoofed');expect(response.body.userId).toBeUndefined();expect(response.body.forwarded).toBeUndefined();expect(response.body.key).toBe('unit-test-secret-only-not-for-deployment');expect(response.body.requestId).not.toBe('spoofed');});
  it('preserves redirect Location and does not follow it',async()=>{const response=await request(createGateway()).get('/s/abc12345');expect(response.status).toBe(302);expect(response.headers.location).toBe('https://example.com/a?x=1#part');expect(response.headers['cache-control']).toBe('no-store');});
  it('routes public root GET and HEAD links while excluding system paths',async()=>{const app=createGateway();for(const method of ['get','head'] as const){const response=await request(app)[method]('/abc12345');expect(response.status).toBe(302);expect(response.headers.location).toBe('https://example.com/a?x=1#part');}for(const path of ['/login','/LOGIN','/profile','/assets','/internal','/bad.code','/ab']){expect((await request(app).get(path)).status).toBe(404);}expect((await request(app).get('/login-123')).status).toBe(302);});
  it('blocks internal paths, invalid origins and missing sessions',async()=>{const app=createGateway();expect((await request(app).get('/internal/visits')).status).toBe(404);expect((await request(app).post('/api/auth/login').set('Origin','https://evil.example').send({})).status).toBe(403);expect((await request(app).get('/api/links')).status).toBe(401);});
  it('forwards JSON bodies without consuming their stream',async()=>{const response=await request(createGateway()).post('/api/links').set('Origin','http://localhost:5173').set('Cookie','short_session=valid').send({originalUrl:'https://example.com'});expect(response.body.body.originalUrl).toBe('https://example.com');});
  it('returns controlled failure for Link and Auth outages',async()=>{process.env.LINK_SERVICE_URL='http://127.0.0.1:1';expect((await request(createGateway()).get('/s/abc12345')).status).toBe(503);process.env.AUTH_SERVICE_URL='http://127.0.0.1:1';expect((await request(createGateway()).get('/api/links').set('Cookie','short_session=valid')).status).toBe(503);});
});

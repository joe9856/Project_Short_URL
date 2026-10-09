import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'dotenv';
const root=resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
for (const [service,model] of [['auth-service','user'],['link-service','link'],['analytics-service','clickEvent']]) {
  const settings=parse(readFileSync(resolve(root,'services',service,'.env')));
  const {PrismaClient}=require(resolve(root,'services',service,'generated/client'));
  const client=new PrismaClient({datasources:{db:{url:settings.DATABASE_URL}}});
  const count=await client[model].count();
  const timezone=await client.$queryRawUnsafe('SELECT current_setting(\'TimeZone\') AS "sessionTimezone", NOW() AS "databaseNow"' );
  console.log(JSON.stringify({service,persistedRows:count,timezone}));
  await client.$disconnect();
}

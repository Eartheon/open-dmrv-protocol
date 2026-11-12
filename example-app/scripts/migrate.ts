import { initialize,pool } from '../server/db.ts';
import { serviceCredential } from '../server/config.ts';
import { importLegacy } from '../server/import-legacy.ts';
try{serviceCredential();await initialize();const imported=await importLegacy();console.log('Open dMRV schema and eight public actor identities are ready. Historical projects imported: '+imported);}catch(error){console.error('Database initialization failed. Check DATABASE_URL, connectivity, permissions and existing signing keys. Code: '+(error as {code?:string}).code);process.exitCode=1;}finally{await pool().end();}

import { importActiveNws } from './nws.js';
import { closeDb } from './db.js';
importActiveNws().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDb);

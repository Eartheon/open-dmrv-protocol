import { pool,initialize,transaction } from '../server/db.ts';
import { origin,serviceCredential } from '../server/config.ts';
import { processMessage } from '../server/workflow.ts';
import { digest } from '../server/protocol.ts';
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
await initialize();console.log('Open dMRV durable worker ready. Callbacks → '+origin+'/on_*');
async function runOne(){
 const job=await transaction(async db=>{const row=(await db.query("SELECT * FROM dmrv.outbox WHERE (status='pending' AND available_at<=now()) OR (status='running' AND locked_until<now()) ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!row)return null;await db.query("UPDATE dmrv.outbox SET status='running',attempts=attempts+1,locked_until=now()+interval '120 seconds' WHERE id=$1",[row.id]);return {...row,attempts:row.attempts+1};});
 if(!job)return false;
 try{
  if(job.kind==='process')await processMessage(job.message_id);
  else{
   const record=(await pool().query('SELECT d.*,m.envelope,m.digest,m.project_id FROM dmrv.callback_deliveries d JOIN dmrv.messages m ON m.message_id=d.message_id WHERE d.message_id=$1',[job.message_id])).rows[0];
   if(record&&record.status!=='delivered'){
    if(record.callback_url!==origin+'/'+record.envelope.context.action)throw Error('Callback target is not the registered same-origin endpoint.');
    if(digest(record.envelope)!==record.digest)throw Error('Persisted callback integrity mismatch.');
    await pool().query('UPDATE dmrv.callback_deliveries SET attempts=attempts+1 WHERE message_id=$1',[job.message_id]);
    const response=await fetch(record.callback_url,{method:'POST',headers:{Authorization:'Bearer '+serviceCredential(),'Content-Type':'application/vnd.open-dmrv+json;version=0.0.1','Idempotency-Key':job.message_id},body:JSON.stringify(record.envelope),redirect:'error',signal:AbortSignal.timeout(15000)});
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{body={error:'Callback returned a non-JSON response'};}
    await pool().query('UPDATE dmrv.callback_deliveries SET last_http_status=$2,last_response=$3 WHERE message_id=$1',[job.message_id,response.status,body]);
    if(!response.ok||body.ack?.status!=='ACK')throw Error('Callback delivery returned HTTP '+response.status);
   }
  }
  await pool().query("UPDATE dmrv.outbox SET status='completed',locked_until=NULL,last_error=NULL WHERE id=$1",[job.id]);
 }catch(error){
  const message=(error as Error).message;await pool().query("UPDATE dmrv.outbox SET status=$2,available_at=now()+($3::int * interval '1 second'),locked_until=NULL,last_error=$4 WHERE id=$1",[job.id,job.attempts>=10?'dead':'pending',Math.min(60,2**job.attempts),message]);
  if(job.kind==='callback')await pool().query("UPDATE dmrv.callback_deliveries SET status='retrying',last_error=$2 WHERE message_id=$1",[job.message_id,message]);
  console.error('Worker job '+job.kind+' failed; '+(job.attempts>=10?'operator retry required':'retry scheduled')+'.');
 }
 return true;
}
while(!stopping){try{const worked=await runOne();if(!worked)await new Promise(resolve=>setTimeout(resolve,750));}catch{console.error('Worker database temporarily unavailable; reconnecting.');await new Promise(resolve=>setTimeout(resolve,2000));}}
await pool().end();

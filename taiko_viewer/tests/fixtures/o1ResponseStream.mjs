// Bounded load-generator sink: keep only a hash, byte count and JPEG signature.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export async function consumeO1Response(response,{jpeg=false}={}){
 const hash=createHash('sha256');let bytes=0;const prefix=[];
 for await(const chunk of response.body){bytes+=chunk.byteLength;assert.ok(bytes<=64*1024*1024,'Synthetic response exceeded 64 MiB sink budget');hash.update(chunk);for(let i=0;i<chunk.length&&prefix.length<2;i++)prefix.push(chunk[i]);}
 if(response.status===200){assert.ok(bytes>0,'Successful response must have a body');if(jpeg){assert.match(response.headers.get('content-type')||'',/^image\/jpeg/);assert.ok(prefix[0]===255&&prefix[1]===216,'JPEG signature required');}else assert.match(response.headers.get('content-type')||'',/application\/json/);}
 return {status:response.status,bytes,sha256:hash.digest('hex')};
}
export async function proveO1StreamingEquivalence(request){
 const streamed=await consumeO1Response(await request());assert.equal(streamed.status,200);
 const response=await request(),text=await response.text();assert.equal(response.status,200);assert.equal(typeof JSON.parse(text),'object');
 const complete={bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
 assert.equal(streamed.bytes,complete.bytes);assert.equal(streamed.sha256,complete.sha256);
 return {status:'PASS',requests:2,streamed,complete,scope:'same authenticated synthetic HTTP JSON route; full body SHA and bytes equal; validation separate from timed cohort'};
}

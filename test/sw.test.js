import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');

function workerHarness(){
  const listeners={},deleted=[],puts=[],cacheHits=new Map(),added=[];
  let claimed=false,skipped=false,fetchImpl=async()=>{throw new Error('offline')};
  const cache={addAll:async files=>added.push(...files),put:async(key,value)=>puts.push([key,value])};
  const caches={open:async()=>cache,keys:async()=>['stack-moonvit-shell-v30','stack-moonvit-shell-v31','stack-moonvit-shell-v32','stack-moonvit-shell-v33','stack-moonvit-shell-v34','stack-moonvit-shell-v35','stack-moonvit-shell-v36','stack-moonvit-shell-v37','stack-moonvit-shell-v38','stack-moonvit-shell-v39'],delete:async key=>{deleted.push(key);return true},match:async key=>cacheHits.get(typeof key==='string'?key:key.url)};
  const self={location:{origin:'https://example.test'},clients:{claim:async()=>{claimed=true}},skipWaiting:async()=>{skipped=true},addEventListener:(type,handler)=>{listeners[type]=handler}};
  vm.runInNewContext(source,{self,caches,URL,fetch:request=>fetchImpl(request),Promise});
  return {listeners,deleted,puts,cacheHits,added,setFetch:value=>{fetchImpl=value},state:()=>({claimed,skipped})};
}

const runWait=async handler=>{let pending;handler({waitUntil:value=>{pending=value}});await pending};
const runFetch=async(handler,request)=>{let pending;handler({request,respondWith:value=>{pending=value}});return pending?await pending:undefined};

test('service worker устанавливает v40 и удаляет только старые кеши',async()=>{
  const worker=workerHarness();
  await runWait(worker.listeners.install);
  assert.equal(worker.state().skipped,true);
  assert.ok(worker.added.includes('./src/app.js?v=40'));
  assert.ok(worker.added.includes('./assets/planets/sleep.webp?v=40'));
  await runWait(worker.listeners.activate);
  assert.deepEqual(worker.deleted,['stack-moonvit-shell-v30','stack-moonvit-shell-v31','stack-moonvit-shell-v32','stack-moonvit-shell-v33','stack-moonvit-shell-v34','stack-moonvit-shell-v35','stack-moonvit-shell-v36','stack-moonvit-shell-v37','stack-moonvit-shell-v38','stack-moonvit-shell-v39']);
  assert.equal(worker.state().claimed,true);
});

test('навигация обновляет оболочку из сети и открывается из кеша офлайн',async()=>{
  const worker=workerHarness(),online={name:'online',clone(){return this}},offline={name:'offline'};
  worker.setFetch(async()=>online);
  const request={method:'GET',mode:'navigate',url:'https://example.test/app'};
  assert.equal(await runFetch(worker.listeners.fetch,request),online);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(worker.puts[0][0],'./');
  worker.cacheHits.set('./',offline);
  worker.setFetch(async()=>{throw new Error('offline')});
  assert.equal(await runFetch(worker.listeners.fetch,request),offline);
});

test('ресурсы берутся из кеша, а чужой origin не перехватывается',async()=>{
  const worker=workerHarness(),cached={name:'cached'};
  const asset={method:'GET',mode:'cors',url:'https://example.test/src/app.js?v=40'};
  worker.cacheHits.set(asset.url,cached);
  assert.equal(await runFetch(worker.listeners.fetch,asset),cached);
  const external={method:'GET',mode:'cors',url:'https://fonts.example/font.woff2'};
  assert.equal(await runFetch(worker.listeners.fetch,external),undefined);
});

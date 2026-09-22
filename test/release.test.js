import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('версия интерфейса, ресурсов и автономного кеша согласована',async()=>{
  const [index,app,ui,store,worker]=await Promise.all(['index.html','src/app.js','src/ui.js','src/store.js','sw.js'].map(read));
  assert.match(index,/manifest\.webmanifest\?v=33/);
  assert.match(index,/styles\/app\.css\?v=33/);
  assert.match(index,/src\/app\.js\?v=33/);
  assert.match(app,/sw\.js\?v=33/);
  assert.match(ui,/APP_VERSION='33'/);
  assert.match(store,/data\.js\?v=33/);
  assert.match(worker,/stack-moonvit-shell-v33/);
  const shell=[...worker.matchAll(/'\.\/([^']+)'/g)].map(match=>match[1].split('?')[0]).filter(Boolean);
  await Promise.all(shell.map(path=>access(new URL(path,root))));
  const manifest=await read('manifest.webmanifest');
  assert.doesNotThrow(()=>JSON.parse(manifest));
});

import test from 'node:test';
import assert from 'node:assert/strict';

const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
const {store}=await import('../src/store.js?v=46');
const {checkinCompleteView}=await import('../src/ui.js?v=46');

test('итог состояния относится к сохранённому миру и не меняет действия или развитие',()=>{
  store.install('FOCUS');
  store.activate('SLEEP');
  store.saveCheckin('FOCUS',{focus:2,clarity:4});
  const before=JSON.stringify(store.state),progress=store.planetProgress('FOCUS');
  const html=checkinCompleteView('FOCUS');
  assert.match(html,/Состояние сохранено/);
  assert.match(html,/FOCUS STACK/);
  assert.match(html,/Фокус и энергия/);
  assert.match(html,/focus\.webp/);
  assert.match(html,/>2<small> \/ 5/);
  assert.match(html,/>4<small> \/ 5/);
  assert.doesNotMatch(html,/sleep\.webp/);
  assert.deepEqual(store.planetProgress('FOCUS'),progress);
  assert.equal(JSON.stringify(store.state),before);
  assert.equal(store.state.activeStack,'SLEEP');
});

test('повторный итог показывает обновлённые оценки той же дневной записи',()=>{
  store.saveCheckin('FOCUS',{focus:5,clarity:1});
  const html=checkinCompleteView('FOCUS',true);
  assert.match(html,/Отметка обновлена/);
  assert.match(html,/>5<small> \/ 5/);
  assert.match(html,/>1<small> \/ 5/);
  assert.deepEqual(store.checkin('FOCUS'),{focus:5,clarity:1});
});

import test from 'node:test';
import assert from 'node:assert/strict';

const RealDate=Date;
let now='2026-09-21T12:00:00Z',moduleIndex=0;

class TestDate extends RealDate{
  constructor(...args){super(...(args.length?args:[now]))}
  static now(){return new RealDate(now).getTime()}
}

class MemoryStorage{
  constructor(){this.values=new Map()}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}

globalThis.Date=TestDate;
globalThis.localStorage=new MemoryStorage();

const baseState=overrides=>({
  onboarded:true,ownerName:'',goal:'SLEEP',moonConnected:false,activeStack:'SLEEP',installed:['SLEEP'],
  records:{'2026-09-21':{done:[],checkins:{},processSteps:{}}},experiments:{},experimentHistory:{},weeklyReviews:[],
  customActions:[],templateActions:[],templateHistory:{},todayHintDismissed:true,onboardingStep:0,...overrides
});

async function loadStore(state){
  now='2026-09-21T12:00:00Z';
  localStorage=new MemoryStorage();
  localStorage.setItem('stack-moonvit-v3',JSON.stringify(state));
  return (await import(`../src/store.js?test=${moduleIndex++}`)).store;
}

test('создаёт новый день без потери предыдущей записи',async()=>{
  const store=await loadStore(baseState({records:{'2026-09-21':{done:['old'],checkins:{},processSteps:{}}}}));
  now='2026-09-22T00:01:00Z';
  assert.equal(store.syncDay(),true);
  assert.deepEqual(store.record('2026-09-21').done,['old']);
  assert.deepEqual(store.record('2026-09-22'),{done:[],checkins:{},processSteps:{}});
  assert.equal(store.syncDay(),false);
});

test('редактирование процесса сохраняет совпавшие шаги и снимает устаревшее выполнение',async()=>{
  const action={id:'process-1',stackCode:'SLEEP',kind:'process',title:'Ритуал',schedule:'daily',days:[],period:'evening',steps:[{id:'step-a',title:'A'},{id:'step-b',title:'B'}],order:0,revisions:[],createdAt:'2026-09-20',pausedAt:null,pauses:[],deletedAt:null,custom:true};
  const store=await loadStore(baseState({customActions:[action],records:{'2026-09-21':{done:['process-1'],checkins:{},processSteps:{'process-1':['step-a','step-b']}}}}));
  assert.equal(store.updateCustomAction('process-1',{stackCode:'SLEEP',title:'Ритуал',schedule:'daily',period:'evening',days:[],steps:['B','C']}),true);
  assert.equal(store.state.customActions[0].steps[0].id,'step-b');
  assert.deepEqual(store.record().processSteps['process-1'],['step-b']);
  assert.equal(store.record().done.includes('process-1'),false);
});

test('удалённое сегодня действие скрыто из плана, но остаётся в истории',async()=>{
  const action={id:'done-then-deleted',stackCode:'SLEEP',kind:'habit',title:'Сделано',schedule:'daily',days:[],period:'day',steps:[],order:0,revisions:[],createdAt:'2026-09-20',pausedAt:null,pauses:[],deletedAt:'2026-09-21',custom:true};
  const store=await loadStore(baseState({customActions:[action],records:{'2026-09-21':{done:['done-then-deleted'],checkins:{},processSteps:{}}}}));
  assert.equal(store.actions('SLEEP','2026-09-21').some(item=>item.id===action.id),false);
  assert.equal(store.actions('SLEEP','2026-09-21',{includeRecorded:true}).some(item=>item.id===action.id),true);
  assert.equal(store.completed('SLEEP','2026-09-21',{includeRecorded:true}),1);
});

test('история использует прошлую категорию, название, расписание и шаги',async()=>{
  const action={id:'revised',stackCode:'FOCUS',kind:'process',title:'Новый процесс',schedule:'daily',days:[],period:'day',steps:[{id:'new-step',title:'Новый шаг'}],order:0,createdAt:'2026-09-18',updatedAt:'2026-09-21',pausedAt:null,pauses:[],deletedAt:null,custom:true,revisions:[{from:'2026-09-18',to:'2026-09-20',snapshot:{stackCode:'SLEEP',title:'Старый процесс',schedule:'custom',days:[0],period:'evening',steps:[{id:'old-step',title:'Старый шаг'}],order:0}}]};
  const store=await loadStore(baseState({installed:['SLEEP','FOCUS'],customActions:[action],records:{'2026-09-20':{done:[],checkins:{},processSteps:{revised:['old-step']}},'2026-09-21':{done:[],checkins:{},processSteps:{}}}}));
  const historical=store.actions('SLEEP','2026-09-20')[0];
  assert.equal(historical.title,'Старый процесс');
  assert.deepEqual(historical.days,[0]);
  assert.equal(historical.steps[0].id,'old-step');
  assert.equal(store.actions('FOCUS','2026-09-20').length,0);
});

test('восстановление старой копии нормализует неполные действия',async()=>{
  const store=await loadStore(baseState({}));
  const restored=store.restore({format:'STACK_MOONVIT_BACKUP',state:baseState({customActions:[{id:'legacy',stackCode:'SLEEP',kind:'process',title:'Старый процесс',schedule:'daily',steps:['Первый шаг'],createdAt:'2026-09-20',custom:true}]})});
  assert.equal(restored,true);
  assert.equal(store.state.customActions[0].steps[0].title,'Первый шаг');
  assert.deepEqual(store.state.customActions[0].pauses,[]);
  assert.deepEqual(store.state.customActions[0].revisions,[]);
  assert.doesNotThrow(()=>store.actions('SLEEP'));
});

test('основной сценарий проходит от расписания до недельного решения и эксперимента',async()=>{
  const store=await loadStore(baseState({}));
  const actionId=store.addCustomAction({stackCode:'SLEEP',title:'Вечерний ритуал',kind:'habit',schedule:'weekdays',period:'evening',days:[],steps:[]});
  assert.ok(actionId);
  for(const date of ['2026-09-21','2026-09-22','2026-09-23']){
    now=`${date}T12:00:00Z`;
    store.syncDay();
    assert.equal(store.actions('SLEEP').some(action=>action.id===actionId),true);
    assert.equal(store.toggle(actionId),true);
    store.saveCheckin('SLEEP',{sleep:4,energy:4});
  }
  const review=store.weeklyReview('SLEEP');
  assert.equal(review.ready,true);
  assert.equal(review.done,3);
  const decision=store.saveWeeklyDecision('SLEEP','experiment');
  assert.equal(decision.type,'experiment');
  assert.equal(store.experiment('SLEEP').actionId,actionId);
  now='2026-09-25T12:00:00Z';
  store.syncDay();
  assert.equal(store.experiment('SLEEP').complete,true);
  assert.equal(store.finishExperiment('SLEEP','better'),true);
  assert.equal(store.lastExperiment('SLEEP').outcome,'better');
});

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

async function loadRaw(value){
  now='2026-09-21T12:00:00Z';
  localStorage=new MemoryStorage();
  localStorage.setItem('stack-moonvit-v3',value);
  return (await import(`../src/store.js?test=${moduleIndex++}`)).store;
}

test('повреждённое локальное состояние не блокирует запуск',async()=>{
  const store=await loadRaw('{broken');
  assert.deepEqual(store.state.installed,['SLEEP']);
  assert.deepEqual(store.record().done,[]);
  assert.deepEqual(store.record().checkins,{});
  assert.deepEqual(store.record().processSteps,{});
});

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

test('редактирование после отметки не переносит историю текущего дня',async()=>{
  const action={id:'same-day',stackCode:'SLEEP',kind:'habit',title:'Старое название',schedule:'daily',days:[],period:'evening',steps:[],order:0,revisions:[],createdAt:'2026-09-20',pausedAt:null,pauses:[],deletedAt:null,custom:true};
  const store=await loadStore(baseState({installed:['SLEEP','FOCUS'],customActions:[action],records:{'2026-09-21':{done:['same-day'],checkins:{},processSteps:{}}}}));
  assert.equal(store.updateCustomAction('same-day',{stackCode:'FOCUS',title:'Новое название',schedule:'weekdays',period:'morning',days:[],steps:[]}),true);
  assert.equal(store.actions('FOCUS','2026-09-21').find(item=>item.id==='same-day').title,'Новое название');
  const historical=store.actions('SLEEP','2026-09-21',{includeRecorded:true}).find(item=>item.id==='same-day');
  assert.equal(historical.title,'Старое название');
  assert.equal(historical.schedule,'daily');
  assert.equal(store.actions('FOCUS','2026-09-21',{includeRecorded:true}).some(item=>item.id==='same-day'),false);
  now='2026-09-22T12:00:00Z';
  store.syncDay();
  assert.equal(store.actions('SLEEP','2026-09-21')[0].title,'Старое название');
  assert.equal(store.completed('SLEEP','2026-09-21'),1);
});

test('повторное редактирование не перезаписывает снимок отмеченного дня',async()=>{
  const action={id:'twice',stackCode:'SLEEP',kind:'habit',title:'Первая версия',schedule:'daily',days:[],period:'evening',steps:[],order:0,revisions:[],createdAt:'2026-09-20',pausedAt:null,pauses:[],deletedAt:null,custom:true};
  const store=await loadStore(baseState({installed:['SLEEP','FOCUS'],customActions:[action],records:{'2026-09-21':{done:['twice'],checkins:{},processSteps:{}}}}));
  store.updateCustomAction('twice',{stackCode:'FOCUS',title:'Вторая версия',schedule:'daily',period:'day',days:[],steps:[]});
  store.updateCustomAction('twice',{stackCode:'FOCUS',title:'Третья версия',schedule:'weekdays',period:'morning',days:[],steps:[]});
  const historical=store.actions('SLEEP','2026-09-21',{includeRecorded:true})[0];
  assert.equal(historical.title,'Первая версия');
  assert.equal(store.state.customActions[0].revisions.filter(item=>item.from==='2026-09-21').length,1);
});

test('пауза, удаление и повторная установка стека не удаляют отметки',async()=>{
  const action={id:'durable',stackCode:'FOCUS',kind:'habit',title:'Фокус',schedule:'daily',days:[],period:'day',steps:[],order:0,revisions:[],createdAt:'2026-09-20',pausedAt:null,pauses:[],deletedAt:null,custom:true};
  const store=await loadStore(baseState({activeStack:'FOCUS',installed:['SLEEP','FOCUS'],customActions:[action],records:{'2026-09-21':{done:['durable'],checkins:{FOCUS:{focus:4,clarity:3}},processSteps:{}}}}));
  store.toggleCustomAction('durable');
  store.deleteCustomAction('durable');
  store.remove('FOCUS');
  assert.equal(store.record('2026-09-21').done.includes('durable'),true);
  assert.deepEqual(store.checkin('FOCUS','2026-09-21'),{focus:4,clarity:3});
  assert.equal(store.install('FOCUS'),true);
  assert.equal(store.actions('FOCUS','2026-09-21',{includeRecorded:true}).some(item=>item.id==='durable'),true);
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

test('восстановление нормализует исторические снимки действий',async()=>{
  const store=await loadStore(baseState({}));
  const restored=store.restore({format:'STACK_MOONVIT_BACKUP',state:baseState({customActions:[{id:'legacy-revision',stackCode:'SLEEP',kind:'process',title:'Новый процесс',schedule:'daily',period:'day',steps:['Новый шаг'],createdAt:'2026-09-18',revisions:[{from:'2026-09-19',to:'2026-09-20',snapshot:{stackCode:'SLEEP',title:'Старый процесс',schedule:'custom',days:['0','7'],period:'evening',steps:['Старый шаг']}}]}]})});
  assert.equal(restored,true);
  const historical=store.actions('SLEEP','2026-09-20')[0];
  assert.deepEqual(historical.days,[0]);
  assert.equal(historical.steps[0].title,'Старый шаг');
  assert.ok(historical.steps[0].id);
});

test('некорректная копия не заменяет текущие данные',async()=>{
  const store=await loadStore(baseState({ownerName:'Анна'})),before=JSON.stringify(store.state);
  assert.equal(store.restore({format:'STACK_MOONVIT_BACKUP',state:{installed:['SLEEP'],records:{'2026-09-21':null}}}),false);
  assert.equal(JSON.stringify(store.state),before);
});

test('старая копия сохраняет период активного готового примера',async()=>{
  const store=await loadStore(baseState({}));
  assert.equal(store.restore({format:'STACK_MOONVIT_BACKUP',state:baseState({templateActions:['sleep-screen']})}),true);
  now='2026-09-22T12:00:00Z';
  store.syncDay();
  assert.equal(store.actions('SLEEP','2026-09-21').some(action=>action.id==='sleep-screen'),true);
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

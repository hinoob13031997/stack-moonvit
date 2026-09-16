import {STACK_LIBRARY,TODAY} from './data.js';

const KEY='stack-moonvit-v3';
const emptyRecord=()=>({done:[],checkins:{}});

function normalizeRecord(record={}){
  const normalized={...emptyRecord(),...record,done:Array.isArray(record.done)?record.done:[],checkins:{...(record.checkins||{})}};
  if((record.sleep!=null||record.energy!=null)&&!normalized.checkins.SLEEP) normalized.checkins.SLEEP={sleep:record.sleep,energy:record.energy};
  return normalized;
}

function migrate(){
  const current=JSON.parse(localStorage.getItem(KEY)||'null');
  if(current){current.records=Object.fromEntries(Object.entries(current.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));return current}
  const old=JSON.parse(localStorage.getItem('stack-moonvit-v2')||localStorage.getItem('stack-moonvit-v1')||'{}');
  const installed=['SLEEP',...(old.stacks||[]).map(s=>s.code)].filter((x,i,a)=>a.indexOf(x)===i&&STACK_LIBRARY[x]);
  const records=Object.fromEntries(Object.entries(old.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));
  if(!records[TODAY()])records[TODAY()]=normalizeRecord({done:old.done||[],sleep:null,energy:null});
  return {onboarded:Boolean(old.onboarded),goal:old.goal||'SLEEP',moonConnected:old.moonConnected!==false,activeStack:old.activeStack||'SLEEP',installed,records,onboardingStep:0};
}

class StackStore{
  constructor(){this.state=migrate();this.ensureToday();this.save()}
  ensureToday(){if(!this.state.records[TODAY()])this.state.records[TODAY()]=emptyRecord()}
  save(){localStorage.setItem(KEY,JSON.stringify(this.state))}
  record(date=TODAY()){return this.state.records[date]||null}
  stack(code=this.state.activeStack){return STACK_LIBRARY[code]||STACK_LIBRARY.SLEEP}
  actions(code=this.state.activeStack){return this.stack(code).actions.filter(a=>this.state.moonConnected||!a.product)}
  checkin(code=this.state.activeStack,date=TODAY()){return this.record(date)?.checkins?.[code]||null}
  toggle(actionId){const r=this.record();r.done=r.done.includes(actionId)?r.done.filter(x=>x!==actionId):[...r.done,actionId];this.save();return r.done.includes(actionId)}
  saveCheckin(code,values){const r=this.record();r.checkins[code]=values;const id=this.stack(code).checkin.id;if(!r.done.includes(id))r.done.push(id);this.save()}
  resetToday(){this.state.records[TODAY()]=emptyRecord();this.save()}
  install(code){if(STACK_LIBRARY[code]&&!this.state.installed.includes(code)){this.state.installed.push(code);this.save();return true}return false}
  remove(code){if(code==='SLEEP')return false;this.state.installed=this.state.installed.filter(x=>x!==code);if(this.state.activeStack===code)this.state.activeStack='SLEEP';this.save();return true}
  activate(code){if(this.state.installed.includes(code)){this.state.activeStack=code;this.save();return true}return false}
  lastDays(count=7){return Array.from({length:count},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})}
  completed(code=this.state.activeStack,date=TODAY()){const r=this.record(date);return r?r.done.filter(id=>this.actions(code).some(a=>a.id===id)).length:0}
  discipline(code=this.state.activeStack){const actions=this.actions(code),days=this.lastDays();if(!actions.length)return 0;return Math.round(days.reduce((sum,date)=>sum+this.completed(code,date)/actions.length,0)/days.length*100)}
  dataDays(){return Object.values(this.state.records).filter(r=>r.done.length||Object.keys(r.checkins||{}).length).length}
}

export const store=new StackStore();

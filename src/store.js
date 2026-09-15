import {STACK_LIBRARY,TODAY} from './data.js';

const KEY='stack-moonvit-v3';

function migrate(){
  const current=JSON.parse(localStorage.getItem(KEY)||'null');
  if(current)return current;
  const old=JSON.parse(localStorage.getItem('stack-moonvit-v2')||localStorage.getItem('stack-moonvit-v1')||'{}');
  const installed=['SLEEP',...(old.stacks||[]).map(s=>s.code)].filter((x,i,a)=>a.indexOf(x)===i);
  const records=old.records||{};
  if(!records[TODAY()])records[TODAY()]={done:old.done||[],sleep:null,energy:null};
  return {onboarded:Boolean(old.onboarded),goal:old.goal||'SLEEP',moonConnected:old.moonConnected!==false,activeStack:old.activeStack||'SLEEP',installed,records,onboardingStep:0};
}

class StackStore{
  constructor(){this.state=migrate();this.ensureToday();this.save()}
  ensureToday(){if(!this.state.records[TODAY()])this.state.records[TODAY()]={done:[],sleep:null,energy:null}}
  save(){localStorage.setItem(KEY,JSON.stringify(this.state))}
  record(date=TODAY()){return this.state.records[date]||null}
  stack(code=this.state.activeStack){return STACK_LIBRARY[code]||STACK_LIBRARY.SLEEP}
  actions(code=this.state.activeStack){return this.stack(code).actions.filter(a=>this.state.moonConnected||!a.product)}
  toggle(actionId){const r=this.record();r.done=r.done.includes(actionId)?r.done.filter(x=>x!==actionId):[...r.done,actionId];this.save();return r.done.includes(actionId)}
  saveCheckin(sleep,energy){const r=this.record();r.sleep=sleep;r.energy=energy;if(!r.done.includes('sleep-checkin'))r.done.push('sleep-checkin');this.save()}
  resetToday(){this.state.records[TODAY()]={done:[],sleep:null,energy:null};this.save()}
  install(code){if(!this.state.installed.includes(code)){this.state.installed.push(code);this.save();return true}return false}
  remove(code){if(code==='SLEEP')return false;this.state.installed=this.state.installed.filter(x=>x!==code);if(this.state.activeStack===code)this.state.activeStack='SLEEP';this.save();return true}
  activate(code){if(this.state.installed.includes(code)){this.state.activeStack=code;this.save();return true}return false}
  lastDays(count=7){return Array.from({length:count},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10)})}
  discipline(){const days=this.lastDays().filter(d=>this.record(d));const actions=this.actions();if(!days.length||!actions.length)return 0;return Math.round(days.reduce((sum,d)=>sum+this.record(d).done.filter(id=>actions.some(a=>a.id===id)).length/actions.length,0)/days.length*100)}
}

export const store=new StackStore();

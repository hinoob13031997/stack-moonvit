import {STACK_LIBRARY,TODAY} from './data.js';

const KEY='stack-moonvit-v3';
const emptyRecord=()=>({done:[],checkins:{},processSteps:{}});
const shiftDay=(date,amount)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+amount);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`};

function normalizeRecord(record={}){
  const normalized={...emptyRecord(),...record,done:Array.isArray(record.done)?record.done:[],checkins:{...(record.checkins||{})},processSteps:{...(record.processSteps||{})}};
  if((record.sleep!=null||record.energy!=null)&&!normalized.checkins.SLEEP) normalized.checkins.SLEEP={sleep:record.sleep,energy:record.energy};
  return normalized;
}

function migrate(){
  const current=JSON.parse(localStorage.getItem(KEY)||'null');
  if(current){current.records=Object.fromEntries(Object.entries(current.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));current.experiments=current.experiments||{};current.experimentHistory=current.experimentHistory||{};current.customActions=current.customActions||[];current.templateActions=current.templateActions||[];current.templateHistory=current.templateHistory||{};current.templateActions.forEach(id=>{if(!(current.templateHistory[id]||[]).some(period=>!period.to))(current.templateHistory[id]=current.templateHistory[id]||[]).push({from:TODAY(),to:null})});return current}
  const old=JSON.parse(localStorage.getItem('stack-moonvit-v2')||localStorage.getItem('stack-moonvit-v1')||'{}');
  const installed=['SLEEP',...(old.stacks||[]).map(s=>s.code)].filter((x,i,a)=>a.indexOf(x)===i&&STACK_LIBRARY[x]);
  const records=Object.fromEntries(Object.entries(old.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));
  if(!records[TODAY()])records[TODAY()]=normalizeRecord({done:old.done||[],sleep:null,energy:null});
  return {onboarded:Boolean(old.onboarded),goal:old.goal||'SLEEP',moonConnected:old.moonConnected!==false,activeStack:old.activeStack||'SLEEP',installed,records,experiments:{},experimentHistory:{},customActions:[],templateActions:[],templateHistory:{},onboardingStep:0};
}

class StackStore{
  constructor(){this.state=migrate();this.ensureToday();this.save()}
  ensureToday(){if(!this.state.records[TODAY()])this.state.records[TODAY()]=emptyRecord()}
  save(){localStorage.setItem(KEY,JSON.stringify(this.state))}
  record(date=TODAY()){return this.state.records[date]||null}
  stack(code=this.state.activeStack){return STACK_LIBRARY[code]||STACK_LIBRARY.SLEEP}
  actions(code=this.state.activeStack,date=TODAY()){const record=this.record(date),historical=date!==TODAY(),base=this.stack(code).actions.filter(action=>(this.templateScheduled(action.id,date)||historical&&(record?.done.includes(action.id)||action.checkin&&record?.checkins?.[code]))&&(this.state.moonConnected||!action.product));return [...base,...this.state.customActions.filter(action=>action.stackCode===code&&this.isScheduled(action,date))]}
  customActions(code=this.state.activeStack){return this.state.customActions.filter(action=>action.stackCode===code&&!action.deletedAt)}
  templates(code=this.state.activeStack){return this.stack(code).actions.filter(action=>this.state.moonConnected||!action.product)}
  templateScheduled(id,date=TODAY()){if(date===TODAY())return this.state.templateActions.includes(id);return (this.state.templateHistory[id]||[]).some(period=>date>=period.from&&(!period.to||date<=period.to))}
  toggleTemplate(id){const action=Object.values(STACK_LIBRARY).flatMap(stack=>stack.actions).find(item=>item.id===id);if(!action)return false;const history=this.state.templateHistory[id]||[];if(this.state.templateActions.includes(id)){this.state.templateActions=this.state.templateActions.filter(item=>item!==id);const open=history.find(period=>!period.to);if(open){if(open.from===TODAY())history.splice(history.indexOf(open),1);else open.to=shiftDay(TODAY(),-1)}}else{this.state.templateActions.push(id);history.push({from:TODAY(),to:null})}this.state.templateHistory[id]=history;this.save();return this.state.templateActions.includes(id)}
  isScheduled(action,date=TODAY()){
    const record=this.record(date),hasHistory=record?.done.includes(action.id)||Boolean(record?.processSteps?.[action.id]?.length);
    const wasPaused=(action.pauses||[]).some(pause=>date>=pause.from&&date<=pause.to);
    if(date<action.createdAt||action.deletedAt&&date>=action.deletedAt&&(date===TODAY()||!hasHistory)||action.pausedAt&&date>=action.pausedAt&&(date===TODAY()||!hasHistory)||wasPaused&&!hasHistory)return false;
    const day=new Date(`${date}T12:00:00`).getDay();
    if(action.schedule==='weekdays')return day>=1&&day<=5;
    if(action.schedule==='custom')return action.days.includes(day);
    return action.schedule==='daily';
  }
  checkin(code=this.state.activeStack,date=TODAY()){return this.record(date)?.checkins?.[code]||null}
  toggle(actionId){const r=this.record();r.done=r.done.includes(actionId)?r.done.filter(x=>x!==actionId):[...r.done,actionId];this.save();return r.done.includes(actionId)}
  saveCheckin(code,values){const r=this.record();r.checkins[code]=values;const id=this.stack(code).checkin.id;if(!r.done.includes(id))r.done.push(id);this.save()}
  resetToday(code=this.state.activeStack){
    const record=this.record(),ids=new Set(this.actions(code).map(action=>action.id));
    record.done=record.done.filter(id=>!ids.has(id));
    ids.forEach(id=>delete record.processSteps[id]);
    delete record.checkins[code];
    this.save();
  }
  install(code){if(STACK_LIBRARY[code]&&!this.state.installed.includes(code)){this.state.installed.push(code);this.save();return true}return false}
  remove(code){if(code==='SLEEP')return false;this.state.installed=this.state.installed.filter(x=>x!==code);delete this.state.experiments[code];if(this.state.activeStack===code)this.state.activeStack='SLEEP';this.save();return true}
  activate(code){if(this.state.installed.includes(code)){this.state.activeStack=code;this.save();return true}return false}
  lastDays(count=7){return Array.from({length:count},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})}
  completed(code=this.state.activeStack,date=TODAY()){const r=this.record(date);return r?r.done.filter(id=>this.actions(code,date).some(a=>a.id===id)).length:0}
  disciplineStats(code=this.state.activeStack){
    const days=this.lastDays().reverse(),first=days.findIndex(date=>this.completed(code,date)>0||this.checkin(code,date));
    if(first<0)return {percent:0,days:0,done:0,total:0};
    const tracked=days.slice(first),done=tracked.reduce((sum,date)=>sum+this.completed(code,date),0),total=tracked.reduce((sum,date)=>sum+this.actions(code,date).length,0);
    if(!total)return {percent:0,days:tracked.length,done:0,total:0};
    return {percent:Math.round(done/total*100),days:tracked.length,done,total};
  }
  discipline(code=this.state.activeStack){return this.disciplineStats(code).percent}
  dataDays(){return Object.values(this.state.records).filter(r=>r.done.length||Object.keys(r.checkins||{}).length||Object.keys(r.processSteps||{}).length).length}
  addCustomAction(input){
    const title=String(input.title||'').trim().slice(0,80),kind=input.kind==='process'?'process':'habit',schedule=['daily','weekdays','custom'].includes(input.schedule)?input.schedule:'daily',period=['morning','day','evening'].includes(input.period)?input.period:'day';
    const days=[...new Set((input.days||[]).map(Number).filter(day=>day>=0&&day<=6))],steps=kind==='process'?(input.steps||[]).map(step=>String(step).trim()).filter(Boolean).slice(0,8):[];
    if(!title||schedule==='custom'&&!days.length||kind==='process'&&!steps.length)return false;
    const stackCode=this.state.installed.includes(input.stackCode)?input.stackCode:this.state.activeStack,id=`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;this.state.customActions.push({id,stackCode,kind,title,schedule,days,period,steps:steps.map((step,index)=>({id:`${id}-step-${index}`,title:step})),createdAt:TODAY(),pausedAt:null,pauses:[],deletedAt:null,custom:true});this.save();return id;
  }
  updateCustomAction(id,input){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;const title=String(input.title||'').trim().slice(0,80),schedule=['daily','weekdays','custom'].includes(input.schedule)?input.schedule:'daily',period=['morning','day','evening'].includes(input.period)?input.period:'day',days=[...new Set((input.days||[]).map(Number).filter(day=>day>=0&&day<=6))],steps=action.kind==='process'?(input.steps||[]).map(step=>String(step).trim()).filter(Boolean).slice(0,8):[];if(!title||schedule==='custom'&&!days.length||action.kind==='process'&&!steps.length||!this.state.installed.includes(input.stackCode))return false;action.title=title;action.stackCode=input.stackCode;action.schedule=schedule;action.period=period;action.days=days;if(action.kind==='process')action.steps=steps.map((step,index)=>action.steps[index]?.title===step?action.steps[index]:{id:`${id}-step-${Date.now()}-${index}`,title:step});this.save();return true}
  suggestCategory(title){const text=String(title||'').toLowerCase(),rules={TRAIN:['трен','зал','кардио','бег','размин','растяж','присед','отжим','спорт'],SLEEP:['сон','спать','кровать','экран перед сном','вечерний ритуал','проснуться'],FOCUS:['фокус','работ','учеб','читать','план','телефон','задач','концентрац'],BALANCE:['прогул','дых','медитац','отдых','настроен','пауза','стресс']};return Object.entries(rules).find(([,words])=>words.some(word=>text.includes(word)))?.[0]||null}
  toggleCustomAction(id){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;if(action.pausedAt){if(action.pausedAt!==TODAY())action.pauses=[...(action.pauses||[]),{from:action.pausedAt,to:TODAY()}];action.pausedAt=null}else action.pausedAt=TODAY();this.save();return !action.pausedAt}
  deleteCustomAction(id){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;action.deletedAt=TODAY();this.save();return true}
  processProgress(action,date=TODAY()){const done=this.record(date)?.processSteps?.[action.id]||[];return {done:done.filter(id=>action.steps.some(step=>step.id===id)).length,total:action.steps.length}}
  toggleProcessStep(actionId,stepId){const action=this.state.customActions.find(item=>item.id===actionId&&item.kind==='process'&&!item.deletedAt);if(!action||!action.steps.some(step=>step.id===stepId))return false;const record=this.record(),current=record.processSteps[actionId]||[];record.processSteps[actionId]=current.includes(stepId)?current.filter(id=>id!==stepId):[...current,stepId];const complete=action.steps.every(step=>record.processSteps[actionId].includes(step.id));record.done=complete?[...new Set([...record.done,actionId])]:record.done.filter(id=>id!==actionId);this.save();return complete}
  relationships(){
    const codes=this.state.installed.filter(code=>STACK_LIBRARY[code]);
    const pairs=[];
    for(let i=0;i<codes.length;i++)for(let j=i+1;j<codes.length;j++){
      const left=codes[i],right=codes[j],points=[];
      Object.values(this.state.records).forEach(record=>{
        const a=record.checkins?.[left],b=record.checkins?.[right];
        if(a&&b)points.push([this.metricAverage(a),this.metricAverage(b)]);
      });
      pairs.push({left,right,points});
    }
    if(!pairs.length)return {ready:false,reason:'single',overlap:0,needed:5};
    const eligible=pairs.filter(pair=>pair.points.length>=5);
    if(!eligible.length){const closest=pairs.sort((a,b)=>b.points.length-a.points.length)[0];return {ready:false,reason:'data',left:closest.left,right:closest.right,overlap:closest.points.length,needed:5-closest.points.length}}
    const measured=eligible.map(pair=>({...pair,correlation:this.correlation(pair.points)})).sort((a,b)=>Math.abs(b.correlation)-Math.abs(a.correlation));
    return {ready:true,...measured[0],overlap:measured[0].points.length};
  }
  metricAverage(values){const numbers=Object.values(values).map(Number).filter(Number.isFinite);return numbers.length?numbers.reduce((sum,value)=>sum+value,0)/numbers.length:0}
  correlation(points){
    const count=points.length,avgX=points.reduce((sum,p)=>sum+p[0],0)/count,avgY=points.reduce((sum,p)=>sum+p[1],0)/count;
    const numerator=points.reduce((sum,p)=>sum+(p[0]-avgX)*(p[1]-avgY),0);
    const spreadX=Math.sqrt(points.reduce((sum,p)=>sum+(p[0]-avgX)**2,0)),spreadY=Math.sqrt(points.reduce((sum,p)=>sum+(p[1]-avgY)**2,0));
    return spreadX&&spreadY?numerator/(spreadX*spreadY):0;
  }
  weakestAction(code=this.state.activeStack){
    const candidates=this.actions(code).filter(action=>!action.checkin&&!action.product),days=this.lastDays();
    const measured=candidates.map(action=>({...action,count:days.filter(date=>this.record(date)?.done.includes(action.id)).length}));
    return measured.some(action=>action.count>0)?measured.sort((a,b)=>a.count-b.count)[0]:null;
  }
  startExperiment(code=this.state.activeStack){const action=this.weakestAction(code);if(!action)return false;this.state.experiments[code]={actionId:action.id,startedAt:TODAY()};this.save();return true}
  finishExperiment(code=this.state.activeStack){const result=this.experiment(code);if(!result)return false;const history=this.state.experimentHistory[code]||[];this.state.experimentHistory[code]=[{actionId:result.actionId,title:result.action.title,startedAt:result.startedAt,finishedAt:TODAY(),done:result.done,days:result.elapsed,success:result.done>=2},...history].slice(0,5);delete this.state.experiments[code];this.save();return true}
  lastExperiment(code=this.state.activeStack){return this.state.experimentHistory[code]?.[0]||null}
  experiment(code=this.state.activeStack){
    const saved=this.state.experiments[code];if(!saved)return null;
    const action=this.actions(code).find(item=>item.id===saved.actionId);if(!action){delete this.state.experiments[code];this.save();return null}
    const start=new Date(`${saved.startedAt}T12:00:00`),today=TODAY(),dates=Array.from({length:3},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`});
    const available=dates.filter(date=>date<=today),done=available.filter(date=>this.record(date)?.done.includes(action.id)).length;
    return {...saved,action,dates,elapsed:available.length,done,complete:today>=dates[2]};
  }
  backup(){return {format:'STACK_MOONVIT_BACKUP',version:1,exportedAt:new Date().toISOString(),state:this.state}}
  restore(payload){
    const incoming=payload?.format==='STACK_MOONVIT_BACKUP'?payload.state:payload?.state;
    if(!incoming||typeof incoming!=='object'||!incoming.records||!Array.isArray(incoming.installed))return false;
    const installed=incoming.installed.filter(code=>STACK_LIBRARY[code]);if(!installed.includes('SLEEP'))installed.unshift('SLEEP');
    this.state={...this.state,...incoming,installed,activeStack:installed.includes(incoming.activeStack)?incoming.activeStack:'SLEEP',records:Object.fromEntries(Object.entries(incoming.records).map(([date,record])=>[date,normalizeRecord(record)])),experiments:incoming.experiments||{},experimentHistory:incoming.experimentHistory||{},customActions:incoming.customActions||[],templateActions:incoming.templateActions||[],templateHistory:incoming.templateHistory||{}};
    this.ensureToday();this.save();return true;
  }
}

export const store=new StackStore();

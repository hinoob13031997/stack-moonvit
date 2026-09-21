import {STACK_LIBRARY,TODAY} from './data.js?v=32';

const KEY='stack-moonvit-v3';
const emptyRecord=()=>({done:[],checkins:{},processSteps:{}});
const shiftDay=(date,amount)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+amount);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`};
const actionSnapshot=action=>({stackCode:action.stackCode,title:action.title,schedule:action.schedule,days:[...(action.days||[])],period:action.period,steps:(action.steps||[]).map(step=>({...step})),order:action.order});
const normalizeAction=(action,index=0)=>({...action,kind:action.kind==='process'?'process':'habit',period:['morning','day','evening'].includes(action.period)?action.period:'day',schedule:['daily','weekdays','custom'].includes(action.schedule)?action.schedule:'daily',days:Array.isArray(action.days)?action.days.map(Number).filter(day=>day>=0&&day<=6):[],steps:Array.isArray(action.steps)?action.steps.map((step,stepIndex)=>typeof step==='string'?{id:`${action.id}-step-${stepIndex}`,title:step}:step?.title?{...step,id:step.id||`${action.id}-step-${stepIndex}`}:null).filter(Boolean):[],pauses:Array.isArray(action.pauses)?action.pauses:[],order:Number.isFinite(action.order)?action.order:index,revisions:Array.isArray(action.revisions)?action.revisions:[],createdAt:action.createdAt||TODAY()});

function normalizeRecord(record={}){
  const normalized={...emptyRecord(),...record,done:Array.isArray(record.done)?record.done:[],checkins:{...(record.checkins||{})},processSteps:{...(record.processSteps||{})}};
  if((record.sleep!=null||record.energy!=null)&&!normalized.checkins.SLEEP) normalized.checkins.SLEEP={sleep:record.sleep,energy:record.energy};
  return normalized;
}

function migrate(){
  const current=JSON.parse(localStorage.getItem(KEY)||'null');
  if(current)current.ownerName=String(current.ownerName||'').trim().slice(0,40);
  if(current){current.records=Object.fromEntries(Object.entries(current.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));current.experiments=current.experiments||{};current.experimentHistory=current.experimentHistory||{};current.weeklyReviews=Array.isArray(current.weeklyReviews)?current.weeklyReviews:[];current.customActions=Array.isArray(current.customActions)?current.customActions.map(normalizeAction):[];current.todayHintDismissed=Boolean(current.todayHintDismissed);current.templateActions=current.templateActions||[];current.templateHistory=current.templateHistory||{};current.templateActions.forEach(id=>{if(!(current.templateHistory[id]||[]).some(period=>!period.to))(current.templateHistory[id]=current.templateHistory[id]||[]).push({from:TODAY(),to:null})});return current}
  const old=JSON.parse(localStorage.getItem('stack-moonvit-v2')||localStorage.getItem('stack-moonvit-v1')||'{}');
  const installed=['SLEEP',...(old.stacks||[]).map(s=>s.code)].filter((x,i,a)=>a.indexOf(x)===i&&STACK_LIBRARY[x]);
  const records=Object.fromEntries(Object.entries(old.records||{}).map(([date,record])=>[date,normalizeRecord(record)]));
  if(!records[TODAY()])records[TODAY()]=normalizeRecord({done:old.done||[],sleep:null,energy:null});
  return {onboarded:Boolean(old.onboarded),ownerName:String(old.ownerName||old.name||'').trim().slice(0,40),goal:old.goal||'SLEEP',moonConnected:Boolean(old.moonConnected),activeStack:old.activeStack||'SLEEP',installed,records,experiments:{},experimentHistory:{},weeklyReviews:[],customActions:[],templateActions:[],templateHistory:{},todayHintDismissed:false,onboardingStep:0};
}

class StackStore{
  constructor(){this.state=migrate();this.day=TODAY();this.ensureToday();this.save()}
  ensureToday(date=TODAY()){if(this.state.records[date])return false;this.state.records[date]=emptyRecord();return true}
  syncDay(){const today=TODAY(),changed=today!==this.day,created=this.ensureToday(today);this.day=today;if(created)this.save();return changed}
  save(){localStorage.setItem(KEY,JSON.stringify(this.state))}
  setOwnerName(value){this.state.ownerName=String(value||'').trim().replace(/\s+/g,' ').slice(0,40);this.save();return this.state.ownerName}
  record(date=TODAY()){if(date===TODAY())this.ensureToday(date);return this.state.records[date]||null}
  stack(code=this.state.activeStack){return STACK_LIBRARY[code]||STACK_LIBRARY.SLEEP}
  actions(code=this.state.activeStack,date=TODAY(),options={}){const record=this.record(date),includeRecorded=options.includeRecorded??date!==TODAY(),base=this.stack(code).actions.filter(action=>!action.checkin&&(this.templateScheduled(action.id,date)||includeRecorded&&record?.done.includes(action.id))&&(includeRecorded||this.state.moonConnected||!action.product));const custom=this.state.customActions.map(action=>this.actionAt(action,date,includeRecorded)).filter(action=>action&&action.stackCode===code&&this.isScheduled(action,date,includeRecorded)).sort((a,b)=>(a.order??0)-(b.order??0));return [...base,...custom]}
  customActions(code=this.state.activeStack){return this.state.customActions.filter(action=>action.stackCode===code&&!action.deletedAt).sort((a,b)=>(a.order??0)-(b.order??0))}
  actionAt(action,date=TODAY(),includeRecorded=false){if(date===TODAY()&&!includeRecorded)return action;const revision=(action.revisions||[]).find(item=>date>=item.from&&date<=item.to);return revision?{...action,...revision.snapshot,revisions:action.revisions}:action}
  templates(code=this.state.activeStack){return this.stack(code).actions.filter(action=>!action.checkin&&(this.state.moonConnected||!action.product))}
  templateScheduled(id,date=TODAY()){if(date===TODAY())return this.state.templateActions.includes(id);return (this.state.templateHistory[id]||[]).some(period=>date>=period.from&&(!period.to||date<=period.to))}
  toggleTemplate(id){const action=Object.values(STACK_LIBRARY).flatMap(stack=>stack.actions).find(item=>item.id===id);if(!action)return false;const history=this.state.templateHistory[id]||[];if(this.state.templateActions.includes(id)){this.state.templateActions=this.state.templateActions.filter(item=>item!==id);const open=history.find(period=>!period.to);if(open){if(open.from===TODAY())history.splice(history.indexOf(open),1);else open.to=shiftDay(TODAY(),-1)}}else{this.state.templateActions.push(id);history.push({from:TODAY(),to:null})}this.state.templateHistory[id]=history;this.save();return this.state.templateActions.includes(id)}
  isScheduled(action,date=TODAY(),includeRecorded=date!==TODAY()){
    const record=this.record(date),hasHistory=record?.done.includes(action.id)||Boolean(record?.processSteps?.[action.id]?.length);
    const wasPaused=(action.pauses||[]).some(pause=>date>=pause.from&&date<=pause.to);
    if(date<action.createdAt||action.deletedAt&&date>=action.deletedAt&&!(includeRecorded&&hasHistory)||action.pausedAt&&date>=action.pausedAt&&!(includeRecorded&&hasHistory)||wasPaused&&!(includeRecorded&&hasHistory))return false;
    if(includeRecorded&&hasHistory)return true;
    const day=new Date(`${date}T12:00:00`).getDay();
    if(action.schedule==='weekdays')return day>=1&&day<=5;
    if(action.schedule==='custom')return action.days.includes(day);
    return action.schedule==='daily';
  }
  checkin(code=this.state.activeStack,date=TODAY()){return this.record(date)?.checkins?.[code]||null}
  toggle(actionId){const r=this.record();r.done=r.done.includes(actionId)?r.done.filter(x=>x!==actionId):[...r.done,actionId];this.save();return r.done.includes(actionId)}
  saveCheckin(code,values){const r=this.record();r.checkins[code]=values;this.save()}
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
  completed(code=this.state.activeStack,date=TODAY(),options={}){const r=this.record(date);return r?r.done.filter(id=>this.actions(code,date,options).some(a=>a.id===id)).length:0}
  disciplineStats(code=this.state.activeStack){
    const days=this.lastDays().reverse(),history={includeRecorded:true},first=days.findIndex(date=>this.completed(code,date,history)>0||this.checkin(code,date));
    if(first<0)return {percent:0,days:0,done:0,total:0};
    const tracked=days.slice(first),done=tracked.reduce((sum,date)=>sum+this.completed(code,date,history),0),total=tracked.reduce((sum,date)=>sum+this.actions(code,date,history).length,0);
    if(!total)return {percent:0,days:tracked.length,done:0,total:0};
    return {percent:Math.round(done/total*100),days:tracked.length,done,total};
  }
  discipline(code=this.state.activeStack){return this.disciplineStats(code).percent}
  weeklyReview(code=this.state.activeStack){
    const dates=this.lastDays().reverse(),history={includeRecorded:true},previous=Array.from({length:7},(_,index)=>shiftDay(TODAY(),-(13-index))),active=dates.filter(date=>this.completed(code,date,history)>0||this.checkin(code,date)),done=dates.reduce((sum,date)=>sum+this.completed(code,date,history),0),total=dates.reduce((sum,date)=>sum+this.actions(code,date,history).length,0),percent=total?Math.round(done/total*100):0;
    const states=dates.map(date=>this.checkin(code,date)).filter(Boolean).map(values=>this.metricAverage(values)),previousStates=previous.map(date=>this.checkin(code,date)).filter(Boolean).map(values=>this.metricAverage(values)),stateAverage=states.length?states.reduce((sum,value)=>sum+value,0)/states.length:null,previousAverage=previousStates.length?previousStates.reduce((sum,value)=>sum+value,0)/previousStates.length:null;
    const ranked=dates.map(date=>{const planned=this.actions(code,date,history).length,completed=this.completed(code,date,history);return {date,completed,planned,ratio:planned?completed/planned:0}}).filter(day=>day.completed||this.checkin(code,day.date)).sort((a,b)=>b.ratio-a.ratio||b.completed-a.completed),best=ranked[0]||null,performance=this.actionPerformance(code,dates),stable=performance[0]||null,focus=performance.length>1?performance[performance.length-1]:performance[0]||null,saved=this.state.weeklyReviews.find(item=>item.code===code&&item.endedAt===TODAY())||null;
    const observation=active.length<3?`Ещё ${3-active.length} ${active.length===2?'день':'дня'} с отметками — и обзор станет содержательнее.`:percent>=70?'На этой неделе действия выполнялись устойчиво. Сохрани ритм и меняй только один элемент.':percent>=40?'Ритм уже формируется. Одно выбранное улучшение полезнее, чем расширение списка.':'Неделя была неровной. Это наблюдение, а не провал: сократи фокус до одного выполнимого действия.';
    return {code,dates,activeDays:active.length,ready:active.length>=3,done,total,percent,stateAverage,previousAverage,stateDelta:stateAverage!=null&&previousAverage!=null?stateAverage-previousAverage:null,best,stable,focus,observation,saved};
  }
  actionPerformance(code=this.state.activeStack,dates=this.lastDays()){const history={includeRecorded:true},actions=new Map();dates.forEach(date=>this.actions(code,date,history).filter(action=>!action.product).forEach(action=>actions.set(action.id,action)));return [...actions.values()].map(action=>{const scheduled=dates.filter(date=>this.actions(code,date,history).some(item=>item.id===action.id)),done=scheduled.filter(date=>this.record(date)?.done.includes(action.id)).length;return {...action,scheduled:scheduled.length,done,ratio:scheduled.length?done/scheduled.length:0}}).filter(action=>action.scheduled).sort((a,b)=>b.ratio-a.ratio||b.done-a.done)}
  saveWeeklyReview(code=this.state.activeStack){const review=this.weeklyReview(code);if(!review.ready)return false;const previous=review.saved||{},snapshot={...previous,code,endedAt:TODAY(),from:review.dates[0],activeDays:review.activeDays,done:review.done,total:review.total,percent:review.percent,stateAverage:review.stateAverage,best:review.best,stable:review.stable?{id:review.stable.id,title:review.stable.title,done:review.stable.done,scheduled:review.stable.scheduled}:null,focus:review.focus?{id:review.focus.id,title:review.focus.title,done:review.focus.done,scheduled:review.focus.scheduled}:null,observation:review.observation};this.state.weeklyReviews=[snapshot,...this.state.weeklyReviews.filter(item=>!(item.code===code&&item.endedAt===TODAY()))].slice(0,24);this.save();return snapshot}
  saveWeeklyDecision(code=this.state.activeStack,type){if(!['keep','simplify','pause','experiment'].includes(type))return false;const review=this.weeklyReview(code),snapshot=this.saveWeeklyReview(code);if(!review.ready||!snapshot)return false;const action=review.focus,decision={type,createdAt:TODAY(),actionId:action?.id||null,title:action?.title||null};snapshot.decision=decision;this.state.weeklyReviews=[snapshot,...this.state.weeklyReviews.filter(item=>!(item.code===code&&item.endedAt===TODAY()))].slice(0,24);if(type==='pause'&&action){const custom=this.state.customActions.find(item=>item.id===action.id&&!item.deletedAt);if(custom&&!custom.pausedAt)this.toggleCustomAction(action.id);else if(!custom&&this.state.templateActions.includes(action.id))this.toggleTemplate(action.id)}if(type==='experiment'&&action)this.startExperiment(code,action.id);this.save();return decision}
  lastWeeklyReview(code=this.state.activeStack){return this.state.weeklyReviews.find(item=>item.code===code)||null}
  activeWeeklyDecision(code=this.state.activeStack){const review=this.state.weeklyReviews.find(item=>item.code===code&&item.decision);if(!review)return null;const age=Math.floor((new Date(`${TODAY()}T12:00:00`)-new Date(`${review.endedAt}T12:00:00`))/86400000);return age>=0&&age<7?review.decision:null}
  dataDays(){return Object.values(this.state.records).filter(r=>r.done.length||Object.keys(r.checkins||{}).length||Object.keys(r.processSteps||{}).length).length}
  addCustomAction(input){
    const title=String(input.title||'').trim().slice(0,80),kind=input.kind==='process'?'process':'habit',schedule=['daily','weekdays','custom'].includes(input.schedule)?input.schedule:'daily',period=['morning','day','evening'].includes(input.period)?input.period:'day';
    const days=[...new Set((input.days||[]).map(Number).filter(day=>day>=0&&day<=6))],steps=kind==='process'?(input.steps||[]).map(step=>String(step).trim()).filter(Boolean).slice(0,8):[];
    if(!title||schedule==='custom'&&!days.length||kind==='process'&&!steps.length)return false;
    const stackCode=this.state.installed.includes(input.stackCode)?input.stackCode:this.state.activeStack,id=`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,order=Math.max(-1,...this.customActions(stackCode).map(action=>action.order??0))+1;this.state.customActions.push({id,stackCode,kind,title,schedule,days,period,steps:steps.map((step,index)=>({id:`${id}-step-${index}`,title:step})),order,revisions:[],createdAt:TODAY(),pausedAt:null,pauses:[],deletedAt:null,custom:true});this.save();return id;
  }
  updateCustomAction(id,input){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;const title=String(input.title||'').trim().slice(0,80),schedule=['daily','weekdays','custom'].includes(input.schedule)?input.schedule:'daily',period=['morning','day','evening'].includes(input.period)?input.period:'day',days=[...new Set((input.days||[]).map(Number).filter(day=>day>=0&&day<=6))],steps=action.kind==='process'?(input.steps||[]).map(step=>String(step).trim()).filter(Boolean).slice(0,8):[];if(!title||schedule==='custom'&&!days.length||action.kind==='process'&&!steps.length||!this.state.installed.includes(input.stackCode))return false;const today=TODAY(),record=this.record(),hasHistory=record.done.includes(id)||Boolean(record.processSteps[id]?.length);action.revisions=action.revisions||[];if(hasHistory&&!action.revisions.some(item=>today>=item.from&&today<=item.to))action.revisions.push({from:today,to:today,snapshot:actionSnapshot(action)});let revisionFrom=action.updatedAt||action.createdAt,yesterday=shiftDay(today,-1),covering;while((covering=action.revisions.find(item=>revisionFrom>=item.from&&revisionFrom<=item.to)))revisionFrom=shiftDay(covering.to,1);if(revisionFrom<=yesterday)action.revisions.push({from:revisionFrom,to:yesterday,snapshot:actionSnapshot(action)});action.title=title;action.stackCode=input.stackCode;action.schedule=schedule;action.period=period;action.days=days;action.updatedAt=today;if(action.kind==='process'){const available=[...(action.steps||[])];action.steps=steps.map((step,index)=>{const match=available.findIndex(item=>item.title===step);if(match>=0)return available.splice(match,1)[0];return {id:`${id}-step-${Date.now()}-${index}`,title:step}});const valid=new Set(action.steps.map(step=>step.id)),done=(record.processSteps[id]||[]).filter(stepId=>valid.has(stepId));record.processSteps[id]=done;record.done=action.steps.every(step=>done.includes(step.id))?[...new Set([...record.done,id])]:record.done.filter(actionId=>actionId!==id)}this.save();return true}
  moveCustomAction(id,direction){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;const items=this.customActions(action.stackCode),index=items.findIndex(item=>item.id===id),other=items[index+direction];if(!other)return false;const order=action.order;action.order=other.order;other.order=order;this.save();return true}
  suggestCategory(title){const text=String(title||'').toLowerCase(),rules={TRAIN:['трен','зал','кардио','бег','размин','растяж','присед','отжим','спорт'],SLEEP:['сон','спать','кровать','экран перед сном','вечерний ритуал','проснуться'],FOCUS:['фокус','работ','учеб','читать','план','телефон','задач','концентрац'],BALANCE:['прогул','дых','медитац','отдых','настроен','пауза','стресс']};return Object.entries(rules).find(([,words])=>words.some(word=>text.includes(word)))?.[0]||null}
  toggleCustomAction(id){const action=this.state.customActions.find(item=>item.id===id&&!item.deletedAt);if(!action)return false;if(action.pausedAt){if(action.pausedAt!==TODAY())action.pauses=[...(action.pauses||[]),{from:action.pausedAt,to:shiftDay(TODAY(),-1)}];action.pausedAt=null}else action.pausedAt=TODAY();this.save();return !action.pausedAt}
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
  stateTrend(code=this.state.activeStack){return this.lastDays().reverse().map(date=>{const values=this.checkin(code,date);return {date,value:values?this.metricAverage(values):null}})}
  actionStateInsight(code=this.state.activeStack){
    const dates=this.lastDays(14).reverse(),candidates=this.actions(code).filter(action=>!action.product),measured=candidates.map(action=>{const points=dates.map(date=>{const state=this.checkin(code,date);if(!state||!this.actions(code,date).some(item=>item.id===action.id))return null;return {done:Boolean(this.record(date)?.done.includes(action.id)),value:this.metricAverage(state)}}).filter(Boolean),withAction=points.filter(point=>point.done),withoutAction=points.filter(point=>!point.done),average=items=>items.length?items.reduce((sum,item)=>sum+item.value,0)/items.length:null;return {action,points:points.length,withCount:withAction.length,withoutCount:withoutAction.length,withAverage:average(withAction),withoutAverage:average(withoutAction)}}).sort((a,b)=>{const delta=item=>item.withAverage!=null&&item.withoutAverage!=null?Math.abs(item.withAverage-item.withoutAverage):-1;return delta(b)-delta(a)}),best=measured[0]||null;
    if(!best)return {ready:false,reason:'actions',points:0,needed:5};
    if(best.points<5||best.withCount<2||best.withoutCount<2)return {ready:false,reason:'data',...best,needed:Math.max(0,5-best.points)};
    return {ready:true,...best,delta:best.withAverage-best.withoutAverage};
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
  suggestedAction(code=this.state.activeStack){const insight=this.actionStateInsight(code);return insight.ready&&insight.delta>.25?insight.action:this.weakestAction(code)}
  startExperiment(code=this.state.activeStack,actionId=null){const action=actionId?this.actions(code).find(item=>item.id===actionId):this.suggestedAction(code);if(!action)return false;this.state.experiments[code]={actionId:action.id,startedAt:TODAY()};this.save();return true}
  finishExperiment(code=this.state.activeStack,outcome){const result=this.experiment(code);if(!result||!['better','same','worse'].includes(outcome))return false;const history=this.state.experimentHistory[code]||[];this.state.experimentHistory[code]=[{actionId:result.actionId,title:result.action.title,startedAt:result.startedAt,finishedAt:TODAY(),done:result.done,days:result.elapsed,outcome,success:outcome==='better'},...history].slice(0,5);delete this.state.experiments[code];this.save();return true}
  lastExperiment(code=this.state.activeStack){return this.state.experimentHistory[code]?.[0]||null}
  experiment(code=this.state.activeStack){
    const saved=this.state.experiments[code];if(!saved)return null;
    const action=this.actions(code).find(item=>item.id===saved.actionId)||this.state.customActions.find(item=>item.id===saved.actionId&&!item.deletedAt)||this.stack(code).actions.find(item=>item.id===saved.actionId);if(!action){delete this.state.experiments[code];this.save();return null}
    const start=new Date(`${saved.startedAt}T12:00:00`),today=TODAY(),dates=Array.from({length:3},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`});
    const available=dates.filter(date=>date<=today),done=available.filter(date=>this.record(date)?.done.includes(action.id)).length;
    return {...saved,action,dates,elapsed:available.length,done,complete:today>=dates[2]};
  }
  backup(){return {format:'STACK_MOONVIT_BACKUP',version:2,exportedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(this.state))}}
  restore(payload){
    const incoming=payload?.format==='STACK_MOONVIT_BACKUP'?payload.state:payload?.state;
    if(!incoming||typeof incoming!=='object'||!incoming.records||!Array.isArray(incoming.installed))return false;
    const installed=incoming.installed.filter(code=>STACK_LIBRARY[code]);if(!installed.includes('SLEEP'))installed.unshift('SLEEP');
    this.state={...this.state,...incoming,ownerName:String(incoming.ownerName||'').trim().replace(/\s+/g,' ').slice(0,40),installed,activeStack:installed.includes(incoming.activeStack)?incoming.activeStack:'SLEEP',records:Object.fromEntries(Object.entries(incoming.records).map(([date,record])=>[date,normalizeRecord(record)])),experiments:incoming.experiments||{},experimentHistory:incoming.experimentHistory||{},weeklyReviews:Array.isArray(incoming.weeklyReviews)?incoming.weeklyReviews:[],customActions:Array.isArray(incoming.customActions)?incoming.customActions.map(normalizeAction):[],templateActions:Array.isArray(incoming.templateActions)?incoming.templateActions:[],templateHistory:incoming.templateHistory||{}};
    this.day=TODAY();this.ensureToday();this.save();return true;
  }
}

export const store=new StackStore();

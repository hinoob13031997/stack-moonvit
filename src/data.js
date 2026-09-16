export const STACK_LIBRARY = {
  SLEEP: {
    code: 'SLEEP', title: 'Сон и восстановление', icon: '◐', removable: false,
    purpose: 'Спокойный вечер, честная оценка сна и устойчивое восстановление.',
    checkin: {id:'sleep-checkin', eyebrow:'Утренняя отметка', title:'Как прошло восстановление?', questions:[{key:'sleep',label:'Качество сна'},{key:'energy',label:'Энергия'}]},
    actions: [
      {id:'sleep-moon', title:'Принять Moonvit Moon', meta:'Вечер · по своему режиму', period:'evening', product:true},
      {id:'sleep-checkin', title:'Оценить сон и энергию', meta:'2 коротких вопроса', period:'morning', checkin:true},
      {id:'sleep-screen', title:'Без экрана перед сном', meta:'30 минут · дисциплина', period:'evening'},
      {id:'sleep-bed', title:'Лечь до выбранного времени', meta:'До 00:00 · режим', period:'evening'}
    ]
  },
  FOCUS: {
    code:'FOCUS', title:'Фокус и энергия', icon:'↗', removable:true,
    purpose:'Защитить внимание и завершить одну важную работу без рассеивания.',
    checkin:{id:'focus-checkin',eyebrow:'Итог фокуса',title:'Как прошла глубокая работа?',questions:[{key:'focus',label:'Концентрация'},{key:'clarity',label:'Ясность ума'}]},
    actions:[
      {id:'focus-priority',title:'Выбрать один главный результат',meta:'1 минута · направление',period:'morning'},
      {id:'focus-session',title:'Фокус-сессия 45 минут',meta:'Без переключений',period:'day'},
      {id:'focus-phone',title:'Убрать телефон из зоны работы',meta:'На время сессии',period:'day'},
      {id:'focus-checkin',title:'Оценить концентрацию',meta:'2 коротких вопроса',period:'evening',checkin:true}
    ]
  },
  TRAIN: {
    code:'TRAIN', title:'Тренировки и восстановление', icon:'△', removable:true,
    purpose:'Тренироваться регулярно, не игнорируя готовность тела и восстановление.',
    checkin:{id:'train-checkin',eyebrow:'После нагрузки',title:'Как отреагировало тело?',questions:[{key:'effort',label:'Качество тренировки'},{key:'recovery',label:'Восстановление'}]},
    actions:[
      {id:'train-readiness',title:'Проверить готовность тела',meta:'Энергия · напряжение · боль',period:'morning'},
      {id:'train-session',title:'Выполнить движение дня',meta:'Тренировка или активное восстановление',period:'day'},
      {id:'train-warmup',title:'Сделать разминку и заминку',meta:'Перед и после нагрузки',period:'day'},
      {id:'train-checkin',title:'Оценить нагрузку',meta:'2 коротких вопроса',period:'evening',checkin:true}
    ]
  },
  BALANCE: {
    code:'BALANCE', title:'Баланс и состояние', icon:'○', removable:true,
    purpose:'Снизить перегрузку и вернуть управляемость состоянию короткими паузами.',
    checkin:{id:'balance-checkin',eyebrow:'Вечерняя отметка',title:'Как изменилось состояние?',questions:[{key:'calm',label:'Спокойствие'},{key:'mood',label:'Настроение'}]},
    actions:[
      {id:'balance-pause',title:'Сделать паузу без экрана',meta:'10 минут · тишина',period:'day'},
      {id:'balance-walk',title:'Выйти на короткую прогулку',meta:'15–20 минут',period:'day'},
      {id:'balance-breathe',title:'Замедлить дыхание',meta:'3 минуты · без таймера',period:'evening'},
      {id:'balance-checkin',title:'Оценить состояние',meta:'2 коротких вопроса',period:'evening',checkin:true}
    ]
  }
};

export const TODAY = () => {
  const date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
export const formatDay = date => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`));
export const longToday = () => new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());

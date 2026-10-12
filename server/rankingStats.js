function previousDay(iso){const date=new Date(`${iso}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);}
export function rankingStreak(plan,today){
 const active=day=>(plan.activity?.[day]||0)>0||(plan.questionActivity?.[day]?.total||0)>0;
 let day=active(today)?today:previousDay(today),days=0;
 while(active(day)&&days<3660){days++;day=previousDay(day);}return days;
}

import {useEffect,useState} from 'react';
import {validClock,clockSeconds,toggleClock} from './sessionClock.js';
function read(key){try{const c=JSON.parse(localStorage.getItem(key));return validClock(c)?c:null;}catch{return null;}}
export function useSessionClock(key,persist=true){
 const [state,setState]=useState(()=>({key,record:persist?read(key):null})),[,tick]=useState(0);
 const record=state.key===key?state.record:persist?read(key):null;
 useEffect(()=>{setState({key,record:persist?read(key):null});const receive=e=>{if(persist&&e.key===key)setState({key,record:persist?read(key):null});};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[key,persist]);
 useEffect(()=>{if(record?.startedAt==null)return;const interval=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(interval);},[record]);
 function save(next){try{if(persist){if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);}}catch{/* Remains usable when browser storage is unavailable. */}setState({key,record:next});}
 return {record,seconds:clockSeconds(record),choose:ref=>save({...ref,elapsedMs:0,startedAt:null}),toggle:ref=>save(toggleClock(record,ref)),clear:()=>save(null)};
}

import {useEffect,useRef,useState} from 'react';
import {validClock,clockSeconds,toggleClock} from './sessionClock.js';
function read(key){try{const c=JSON.parse(localStorage.getItem(key));return validClock(c)?c:null;}catch{return null;}}
export function useSessionClock(key,persist=true){
 const [state,setState]=useState(()=>({key,record:persist?read(key):null})),[,tick]=useState(0),memory=useRef(new Map());
 const record=state.key===key?state.record:persist?read(key):null;
 const topicKey=ref=>`${key}:${JSON.stringify([ref.materiaId,ref.topicId])}`;
 function remember(clock){const storageKey=topicKey(clock);memory.current.set(storageKey,clock);try{if(persist)localStorage.setItem(storageKey,JSON.stringify(clock));}catch{}}
 useEffect(()=>{setState({key,record:persist?read(key):null});const receive=e=>{if(persist&&e.key===key)setState({key,record:read(key)});};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[key,persist]);
 useEffect(()=>{if(record?.startedAt==null)return;const interval=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(interval);},[record]);
 function save(next){if(next)remember(next);try{if(persist){if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);}}catch{}setState({key,record:next});}
 const savedTopic=ref=>(persist?read(topicKey(ref)):null)||memory.current.get(topicKey(ref));
 function choose(ref){
  if(record?.materiaId===ref.materiaId&&record?.topicId===ref.topicId)return;
  if(record)remember({...record,elapsedMs:clockSeconds(record)*1000,startedAt:null});
  const stored=savedTopic(ref);
  save({...ref,elapsedMs:validClock(stored)?clockSeconds(stored)*1000:0,startedAt:null});
 }
 function clear(){if(record){memory.current.delete(topicKey(record));try{if(persist)localStorage.removeItem(topicKey(record));}catch{}}save(null);}
 return {record,seconds:clockSeconds(record),choose,toggle:ref=>save(toggleClock(record||savedTopic(ref),ref)),clear};
}

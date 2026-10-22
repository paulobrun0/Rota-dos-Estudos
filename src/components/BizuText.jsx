import React from 'react';
import { colors } from '../styles/colors.js';

// A tiny, deliberately text-only syntax; raw HTML and links are never executed.
export function BizuText({ text }) {
  return <div style={{fontSize:14,lineHeight:1.65,overflowWrap:'anywhere'}}>{text.split('\n').map((line,index)=><p key={index} style={{margin:'6px 0'}}>{line.split(/(\*\*[^*\n]+\*\*|==[^=\n]+==|__[^_\n]+__)/g).map((part,i)=>{
    if(part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('==') && part.endsWith('==')) return <mark key={i} style={{background:colors.accentSoft,color:colors.text,borderRadius:3,padding:'0 2px'}}>{part.slice(2,-2)}</mark>;
    if(part.startsWith('__') && part.endsWith('__')) return <u key={i}>{part.slice(2,-2)}</u>;
    return part;
  })}</p>)}</div>;
}

import React from 'react';
import { colors } from '../styles/colors.js';
export function Panel({ title, children, action }) {
  return <section className="study-panel"><div className="study-panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Metric({ label, value, hint }) {
  return <div className="study-metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}
export function ProgressBar({ value, label }) {
  return <div><div style={{ display:'flex', justifyContent:'space-between', gap:8, fontSize:12, marginBottom:6 }}><span>{label}</span><span>{value}%</span></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{ height:6, borderRadius:9, background:colors.surface2, overflow:'hidden' }}><div style={{ width:`${value}%`, height:'100%', background:colors.accent }} /></div></div>;
}

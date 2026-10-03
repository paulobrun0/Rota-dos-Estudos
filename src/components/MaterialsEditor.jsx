import React, { useState } from 'react';
import { uid } from '../lib/id.js';
import { isSafeStudyLink } from '../lib/planValidation.js';
import { inputStyle, secondaryBtnStyle } from '../styles/shared.js';
import { colors } from '../styles/colors.js';
export const MATERIAL_TYPES = {pdf:'PDF',video:'Videoaula',notebook:'Caderno de questões',other:'Outro material'};
export function MaterialsEditor({ materials, onChange }) {
  const [name,setName]=useState('');const [url,setUrl]=useState('');const [type,setType]=useState('pdf');const [error,setError]=useState('');
  function add(){if(!name.trim()||!url.trim()||!isSafeStudyLink(url.trim())){setError('Informe o nome e um link válido começando com https:// ou http://.');return;}onChange([...materials,{id:uid(),name:name.trim(),url:url.trim(),type}]);setName('');setUrl('');setError('');}
  return <div className="study-form"><strong style={{fontSize:13}}>Materiais deste assunto</strong><div className="form-grid"><label>Nome do material<input maxLength={180} value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/></label><label>Tipo de material<select aria-label="Tipo de material" value={type} onChange={e=>setType(e.target.value)} style={inputStyle}>{Object.entries(MATERIAL_TYPES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Link do material<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" style={inputStyle}/></label></div><button type="button" onClick={add} style={secondaryBtnStyle}>Adicionar material à lista</button>{error&&<p role="alert" style={{color:colors.red}}>{error}</p>}
    {materials.map(m=><div className="insight-row" key={m.id}><div><a href={m.url} target="_blank" rel="noopener noreferrer" style={{color:colors.accent}}>{m.name}</a><small>{MATERIAL_TYPES[m.type]}</small></div><button type="button" aria-label={`Remover material ${m.name}`} onClick={()=>onChange(materials.filter(x=>x.id!==m.id))} style={secondaryBtnStyle}>Remover</button></div>)}<small className="muted">A lista será gravada ao clicar em salvar links.</small></div>;
}

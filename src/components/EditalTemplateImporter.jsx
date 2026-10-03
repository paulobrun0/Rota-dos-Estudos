import React, { useState } from 'react';
import { prepareEditalTemplate, exportEditalTemplate, STARTER_TEMPLATES } from '../lib/editalTemplates.js';
import { Panel } from './StudyPanels.jsx';
import { secondaryBtnStyle, primaryBtnStyle, inputStyle } from '../styles/shared.js';
import { colors } from '../styles/colors.js';
export function EditalTemplateImporter({ onImport, activeConcurso }) {
  const [preview,setPreview]=useState(null);const [error,setError]=useState('');const [text,setText]=useState('');
  function prepare(raw){try{setPreview(prepareEditalTemplate(raw));setError('');}catch(e){setPreview(null);setError(e.message);}}
  async function read(file){if(!file)return;if(file.size>2*1024*1024){setPreview(null);setError('O arquivo deve ter até 2 MB.');return;}try{prepare(JSON.parse(await file.text()));}catch{setPreview(null);setError('Não foi possível ler o JSON. Confira o formato do modelo.');}}
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(exportEditalTemplate(activeConcurso),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='modelo-edital.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <Panel title="Modelos de edital e importação" action={activeConcurso&&<button onClick={download} style={secondaryBtnStyle}>Exportar modelo atual</button>}>
    <p className="muted">Os modelos iniciais abaixo são exemplos de estrutura. Confira matérias e assuntos no edital oficial. A importação cria um novo concurso com o progresso zerado e preserva todos os existentes.</p>
    <div className="topic-actions">{STARTER_TEMPLATES.map((m,i)=><button key={i} onClick={()=>prepare(m)} style={secondaryBtnStyle}>{m.name}</button>)}</div>
    <div className="study-form"><label>Arquivo de modelo JSON<input aria-label="Arquivo de modelo JSON" type="file" accept="application/json,.json" onChange={e=>read(e.target.files?.[0])} style={{...inputStyle,maxWidth:'100%'}}/></label><details><summary>Ou colar modelo JSON</summary><textarea aria-label="Modelo JSON" maxLength={2097152} rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder={'{"name":"Meu concurso","materias":[{"name":"Português","topics":[{"name":"Crase"}]}]}'} style={{...inputStyle,width:'100%',marginTop:10}}/><button onClick={()=>{try{prepare(JSON.parse(text));}catch{setPreview(null);setError('JSON inválido.');}}} style={secondaryBtnStyle}>Visualizar importação</button></details></div>
    {error&&<p role="alert" style={{color:colors.red}}>{error}</p>}
    {preview&&<div className="study-form" aria-label="Prévia da importação"><h3>{preview.name}</h3><p className="muted">{preview.materias.length} matérias · {preview.materias.reduce((s,m)=>s+m.topics.length,0)} assuntos · {preview.banca || 'Banca não informada'}</p>{preview.materias.map(m=><details key={m.id}><summary>{m.name} · {m.topics.length} assuntos</summary><ul>{m.topics.map(t=><li key={t.id}>{t.name}{t.materials?.length?` · ${t.materials.length} materiais`:''}</li>)}</ul></details>)}<div className="topic-actions"><button onClick={()=>{onImport(preview);setPreview(null);setText('');}} style={primaryBtnStyle}>Importar como novo concurso</button><button onClick={()=>setPreview(null)} style={secondaryBtnStyle}>Cancelar prévia</button></div></div>}
  </Panel>;
}

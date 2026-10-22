import { BizuText } from "./BizuText.jsx";
import { getPmBizu } from "../lib/pmBizu.js";
import React, { useId, useState } from 'react';
import { colors } from '../styles/colors.js';
import { inputStyle, secondaryBtnStyle } from '../styles/shared.js';

// Kept apart from notes: reviewing a bizu never completes a study session.
export function TopicBizu({ topic, onSave }) {
  const id = useId();
  const content = topic.bizu ?? getPmBizu(topic.name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content || '');
  const [tab, setTab] = useState('bizu');
  function edit() { setDraft(content || ''); setEditing(true); }
  return <section aria-label={`Revisão de ${topic.name}`} style={{marginTop:10, padding:16, border:`1px solid ${colors.border}`, borderRadius:10, maxWidth:640}}>
    <div role="tablist" aria-label="Revisão do assunto">
      <button id={`${id}-tab`} type="button" role="tab" aria-selected={tab === 'bizu'} aria-controls={`${id}-panel`} onClick={() => setTab('bizu')} style={{...secondaryBtnStyle, marginTop:0}}>Bizu</button>
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab`}>
      <h4 style={{margin:'12px 0 8px', fontSize:14}}>{topic.name}</h4>
      {editing ? <form onSubmit={e => {e.preventDefault(); onSave(draft.trim()); setEditing(false);}}>
        <label style={{display:'grid', gap:6, fontSize:12}}>Explicação curta
          <textarea aria-label={`Editar bizu de ${topic.name}`} value={draft} maxLength={1200} rows={5} onChange={e=>setDraft(e.target.value)} placeholder={'Ideia principal em uma frase.\nRegra que resolve a questão.\nExemplo curto.\nPegadinha, se houver.'} style={{...inputStyle,width:'100%',boxSizing:'border-box',resize:'vertical'}} />
        </label>
        <small style={{color:colors.textMuted}}>Até 5 linhas · **negrito** · ==destaque== · __sublinhado__ · {draft.length}/1200</small>
        <div style={{display:'flex', gap:8}}><button type="submit" style={secondaryBtnStyle}>Salvar bizu</button><button type="button" onClick={()=>setEditing(false)} style={secondaryBtnStyle}>Cancelar</button></div>
      </form> : <>
        {content?.trim() ? <BizuText text={content} /> : <p style={{color:colors.textMuted,fontSize:13}}>Bizu deste assunto ainda não cadastrado.</p>}
        <button type="button" onClick={edit} style={{...secondaryBtnStyle,fontSize:12}}>{content?.trim() ? 'Editar bizu' : 'Adicionar bizu'}</button>
      </>}
    </div>
  </section>;
}

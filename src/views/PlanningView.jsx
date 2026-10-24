import React,{useState} from 'react';
import {Panel,Metric} from '../components/StudyPanels.jsx';
import {primaryBtnStyle,secondaryBtnStyle} from '../styles/shared.js';
import {todayISO} from '../lib/date.js';
import {applyLearningPlan,planningHours,planningPreview} from '../lib/learningPlanning.js';
import './planning.css';

const days=[['seg','Segunda'],['ter','Terça'],['qua','Quarta'],['qui','Quinta'],['sex','Sexta'],['sab','Sábado'],['dom','Domingo']];
const kinds={theory:'Teoria',questions:'Questões',review:'Revisão'};
const number=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);

export function PlanningView({data,concurso,onSave,onNavigate}) {
  const [draft,setDraft]=useState(()=>structuredClone(concurso));
  const [hours,setHours]=useState(()=>planningHours(data,concurso));
  const [selected,setSelected]=useState(concurso.materias[0]?.id);
  const [date,setDate]=useState(todayISO),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
  function change(){setDirty(true);setSaved(false);setError('');}
  function editMateria(id,field,value){change();setDraft(d=>({...d,materias:d.materias.map(m=>{
    if(m.id===id)return {...m,learning:{...m.learning,[field]:value}};
    // A dependency requires active theory; remove it when that prerequisite
    // is deliberately disabled or converted to questions only.
    if(m.learning?.afterMateriaId===id&&((field==='enabled'&&!value)||(field==='mode'&&value==='questions')))
      return {...m,learning:{...m.learning,afterMateriaId:''}};
    return m;
  })}));}
  function editTopic(mId,id,field,value){change();setDraft(d=>({...d,materias:d.materias.map(m=>m.id!==mId?m:{...m,topics:m.topics.map(t=>t.id!==id?t:{...t,[field]:value})})}));}
  let preview,previewError='';
  try{const next=applyLearningPlan(data,draft,hours);if(/^\d{4}-\d{2}-\d{2}$/.test(date))preview=planningPreview(next,concurso.id,date);}
  catch(err){previewError=err.message;}
  const weekly=Object.values(hours).reduce((n,h)=>n+(Number(h)||0),0);
  const active=draft.materias.filter(m=>m.learning?.enabled!==false);
  const newPercent=draft.learningBalance?.newPercent??50;
  function save(e){e.preventDefault();try{applyLearningPlan(data,draft,hours);onSave(draft,hours);setError('');setDirty(false);setSaved(true);}catch(err){setError(err.message);}}
  return <form className="planning-view" onSubmit={save}>
    <div className="planning-heading"><div><span className="eyebrow">SEU RITMO DE ESTUDO</span><h2>Planejamento</h2><p>Defina seu tempo, organize as matérias e confira o que entra na fila.</p></div><span className="planning-badge">{dirty?'Alterações por aplicar':saved?'Configuração aplicada':'Configuração atual'}</span></div>
    <div className="study-metrics"><Metric label="Disponibilidade semanal" value={`${number(weekly)} h`} hint="Horários compartilhados entre seus editais"/><Metric label="Matérias ativas" value={`${active.length} / ${draft.materias.length}`}/><Metric label="Assuntos ativos" value={active.reduce((n,m)=>n+m.topics.filter(t=>t.enabled!==false).length,0)}/></div>
    <Panel title="01 · Sua semana"><p className="muted">Horas de estudo por dia. Use zero para folga; 1,5 h equivale a 1 h 30 min.</p>
      <div className="planning-week">{days.map(([key,label])=><label key={key} className={Number(hours[key])===0?'day-off':''}><span>{label}</span><div><input aria-label={`Horas de ${key}`} type="number" min="0" max="24" step="any" required value={hours[key]} onChange={e=>{change();setHours(h=>({...h,[key]:e.target.value}));}}/><span>h</span></div><small>{Number(hours[key])===0?'Folga':`${Math.round((Number(hours[key])||0)*60)} min`}</small></label>)}</div>
      <div className="planning-balance"><div><strong>Conteúdo novo e revisões</strong><p className="muted">Tempo não usado por uma categoria pode ser aproveitado pela outra.</p></div><label><span>{newPercent}% novo <b>·</b> {100-newPercent}% revisão</span><input aria-label="Reserva de conteúdo novo" type="range" min="0" max="100" step="1" value={newPercent} onChange={e=>{change();setDraft(d=>({...d,learningBalance:{...d.learningBalance,newPercent:Number(e.target.value)}}));}}/></label></div>
    </Panel>
    <Panel title="02 · Matérias e assuntos"><p className="muted">A frequência distribui mais tarefas para uma matéria, sem repetir assuntos. Abra “Assuntos” para ajustar prioridades, teoria e duração.</p>
      <div className="planning-table-wrap"><table className="planning-table"><colgroup><col style={{width:'34%'}}/><col style={{width:'13%'}}/><col style={{width:'33%'}}/><col style={{width:'20%'}}/></colgroup><thead><tr><th>Matéria</th><th>Ativa</th><th>Modo de estudo</th><th>Frequência</th></tr></thead><tbody>{draft.materias.map(m=><React.Fragment key={m.id}>
        <tr className={selected===m.id?'planning-selected':''}><td><strong>{m.name}</strong><button className="planning-disclosure" type="button" aria-label={`Configurar assuntos de ${m.name}`} aria-expanded={selected===m.id} onClick={()=>setSelected(selected===m.id?null:m.id)}>{m.topics.length} assuntos <span aria-hidden="true">{selected===m.id?'−':'+'}</span></button></td><td><input aria-label={`Ativar ${m.name} no painel`} type="checkbox" checked={m.learning?.enabled!==false} onChange={e=>editMateria(m.id,'enabled',e.target.checked)}/></td><td><select aria-label={`Modo de ${m.name}`} value={m.learning?.mode||'questions'} onChange={e=>editMateria(m.id,'mode',e.target.value)}><option value="questions">Só questões</option><option value="mixed">Teoria e questões</option></select></td><td><input aria-label={`Frequência de ${m.name}`} type="number" min="1" max="10" required value={m.learning?.frequency??1} onChange={e=>editMateria(m.id,'frequency',e.target.value===''?'':Number(e.target.value))}/></td></tr>
        {selected===m.id&&<tr><td colSpan="4" className="planning-detail"><div className="planning-detail-heading"><div><strong>Assuntos · {m.name}</strong><p className="muted">Teoria concluída libera a prática; não acrescenta questões ao histórico.</p></div><label>Começar após a teoria de<select aria-label={`Dependência de ${m.name}`} value={m.learning?.afterMateriaId||''} onChange={e=>editMateria(m.id,'afterMateriaId',e.target.value)}><option value="">Sem dependência</option>{m.learning?.afterMateriaId&&!draft.materias.some(p=>p.id===m.learning.afterMateriaId&&p.learning?.enabled!==false&&p.learning?.mode==='mixed')&&<option value={m.learning.afterMateriaId}>Dependência indisponível — ajuste</option>}{draft.materias.filter(p=>p.id!==m.id&&p.learning?.enabled!==false&&p.learning?.mode==='mixed').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
          <table className="planning-table planning-topics"><colgroup><col style={{width:'34%'}}/><col style={{width:'10%'}}/><col style={{width:'24%'}}/><col style={{width:'14%'}}/><col style={{width:'18%'}}/></colgroup><thead><tr><th>Assunto</th><th>Ativo</th><th>Prioridade</th><th>Teoria feita</th><th>Minutos</th></tr></thead><tbody>{m.topics.map(t=><tr key={t.id}><td>{t.name}</td><td><input aria-label={`Ativar ${t.name}`} type="checkbox" checked={t.enabled!==false} onChange={e=>editTopic(m.id,t.id,'enabled',e.target.checked)}/></td><td><select aria-label={`Importância de ${t.name}`} value={t.criticality||'normal'} onChange={e=>editTopic(m.id,t.id,'criticality',e.target.value)}><option value="normal">Normal</option><option value="critical">Crítico</option><option value="low">Baixa</option></select></td><td><input aria-label={`Teoria concluída de ${t.name}`} type="checkbox" checked={Boolean(t.theoryDone??t.status==='estudado')} onChange={e=>editTopic(m.id,t.id,'theoryDone',e.target.checked)}/></td><td><input aria-label={`Minutos de ${t.name}`} type="number" min="5" max="180" value={t.exerciseMinutes??''} placeholder="Auto" onChange={e=>editTopic(m.id,t.id,'exerciseMinutes',e.target.value===''?undefined:Number(e.target.value))}/></td></tr>)}</tbody></table>
          {!m.topics.length&&<p className="muted">Cadastre assuntos nesta matéria para gerar tarefas.</p>}
        </td></tr>}
      </React.Fragment>)}</tbody></table></div>
      {!draft.materias.length&&<p className="muted">Cadastre matérias e assuntos no edital para começar.</p>}
    </Panel>
    <Panel title="03 · Prévia da fila" action={<label className="planning-date">Data<input aria-label="Data da prévia do planejamento" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>}>
      <p className="muted">A prévia acompanha seus ajustes antes de salvar. Essas regras organizam a fila de Estudar hoje. Salve para aplicar as mudanças.</p>
      {previewError&&<p className="planning-notice">{previewError}</p>}
      {preview&&<><div className="planning-preview-stats"><span><strong>{preview.queue.length}</strong> tarefas</span><span><strong>{preview.queue.reduce((n,r)=>n+r.minutes,0)} min</strong> planejados</span><span>{preview.completed} min já registrados · {preview.remaining} min disponíveis</span></div>
        {preview.blocked.length>0&&<p className="planning-notice">Aguardando a teoria da matéria anterior: {preview.blocked.join(', ')}.</p>}
        {preview.message&&<p className="planning-notice">{preview.message}</p>}
        {preview.queue.length>0&&<div className="planning-table-wrap"><table className="planning-table"><colgroup><col style={{width:'28%'}}/><col style={{width:'40%'}}/><col style={{width:'20%'}}/><col style={{width:'12%'}}/></colgroup><thead><tr><th>Matéria</th><th>Assunto</th><th>Etapa</th><th>Min</th></tr></thead><tbody>{preview.queue.map(r=><tr key={`${r.materiaId}:${r.topicId}`}><td>{r.materiaName}</td><td>{r.topicName}</td><td><span className="planning-kind">{kinds[r.kind]}</span></td><td>{r.minutes}</td></tr>)}</tbody></table></div>}
        {preview.waiting>0&&preview.queue.length>0&&<p className="muted">{preview.waiting} tarefas elegíveis ficaram fora desta fila por falta de tempo.</p>}
      </>}
    </Panel>
    <div className="planning-save"><div>{error?<p role="alert">{error}</p>:saved?<p role="status">Configuração aplicada. Acompanhe o salvamento no topo da plataforma.</p>:<p>{dirty?'Salve para aplicar os ajustes à fila.':'Pronto para ajustar seu planejamento.'}</p>}<small>O histórico de questões e as sessões já registradas são preservados.</small></div><div className="planning-save-actions"><button style={primaryBtnStyle} type="submit">Salvar planejamento</button>{onNavigate&&<button style={secondaryBtnStyle} type="button" disabled={dirty} onClick={()=>onNavigate('painel')}>Abrir painel</button>}</div></div>
  </form>;
}

import {reviewStudyMark} from "../lib/learningTools.js";
import {NotebookCatalogView} from "./NotebookCatalogView.jsx";
import {PdfStudyView} from "./PdfStudyView.jsx";
import React,{useMemo,useState} from 'react';
import {Brand} from '../components/Brand.jsx';
import {NavItem} from '../components/NavItem.jsx';
import {BookOpen,CalendarDays,Target,ListChecks,NotebookText,Settings,Flame,ChevronLeft} from '../components/Icons.jsx';
import {LearningDashboard} from './LearningDashboard.jsx';
import {PerformanceView,AlertsView,PlanningView,ExternalReviewView,MarksView,QuestionHubView,LearningHelp} from './LearningViews.jsx';
import {StudyToolsView} from './StudyToolsView.jsx';
import {todayISO,addDaysISO} from '../lib/date.js';
import {completeLearningSession,reviewExternalEntry} from '../lib/learningTools.js';
import {decorateConcurso,buildPracticeIndex} from '../lib/editalCompatibility.js';
import {validatePlanData} from '../lib/planValidation.js';
export function previewData(){const today=todayISO();return {concursos:[{id:'demo',name:'Meu próximo concurso',banca:'Banca do edital',examDate:addDaysISO(today,90),settings:{minutesPerMateria:30,topicsPerDay:1},materias:[{id:'portugues',name:'Língua Portuguesa',learning:{mode:'questions',frequency:2},topics:[{id:'crase',name:'Crase',status:'pendente',questionsTotal:30,questionsCorrect:24,criticality:'normal'},{id:'pontuacao',name:'Pontuação',status:'pendente'}]},{id:'administrativo',name:'Direito Administrativo',learning:{mode:'questions'},topics:[{id:'atos',name:'Atos administrativos',status:'estudado',questionsTotal:20,questionsCorrect:12,nextReviewDate:today,reviewStep:0,criticality:'critical'}]}],dailyPlans:{}}],activeConcursoId:'demo',studyPreferences:{weeklyQuestionsGoal:150,dailyHours:{dom:0,seg:2,ter:2,qua:2,qui:2,sex:2,sab:1}},studyDays:['seg','ter','qua','qui','sex','sab'],activity:{},studyMinutes:{},questionActivity:{[addDaysISO(today,-2)]:{total:25,correct:20},[addDaysISO(today,-1)]:{total:30,correct:24},[today]:{total:15,correct:12}},studySessions:[],externalReviews:[],studyMarks:[]};}
// Public visual demo: synthetic in-memory data only. It never requests account
// data, supplies a token or changes authentication on the real application.
export function LearningPreview(){
 const [data,setData]=useState(previewData),[tab,setTab]=useState('painel'),[collapsed,setCollapsed]=useState(false);
 const concurso=useMemo(()=>decorateConcurso(data.concursos[0],buildPracticeIndex(data.concursos)),[data]);
 const nav=[['painel','Painel',CalendarDays],['desempenho','Desempenho',Target],['planejamento','Planejamento',ListChecks],['alertas','Alertas',Flame],['revisao','Caderno de revisão',NotebookText],['marcacoes','Minhas marcações',BookOpen],['avulsas','Questões avulsas',Target],['pdf','Leitor PDF',BookOpen],['ferramentas','Ferramentas',Settings]];
 function register(m,t,total,correct){setData(d=>({...d,concursos:d.concursos.map(c=>({...c,materias:c.materias.map(mat=>mat.id!==m?mat:{...mat,topics:mat.topics.map(topic=>topic.id!==t?topic:{...topic,questionsTotal:(topic.questionsTotal||0)+total,questionsCorrect:(topic.questionsCorrect||0)+correct})})}))}));}
 return <div style={{display:'flex',minHeight:'100vh'}}><nav aria-label="Navegação da demonstração" className={`app-nav${collapsed?' collapsed':''}`} style={{width:238,padding:'24px 14px',flexShrink:0}}><div className="nav-toggle-row"><button aria-label="Recolher menu da demonstração" style={{background:'transparent',border:0,color:'white'}} onClick={()=>setCollapsed(v=>!v)}><ChevronLeft/></button></div><div className="nav-brand" style={{marginBottom:25}}><Brand compact/></div>{nav.map(([key,label,Icon])=><NavItem key={key} label={label} icon={<Icon size={20}/>} active={tab===key} onClick={()=>setTab(key)}/>)}</nav><main className="app-main" style={{padding:'32px 36px',flex:1,minWidth:0,maxWidth:1320,margin:'0 auto'}}><header className="app-heading"><div><span className="eyebrow">Prévia com dados fictícios</span><h1 className="sg">Questão de Ritmo</h1><p>Demonstração visual. As alterações aqui ficam apenas nesta página.</p></div><a href={import.meta.env.BASE_URL} style={{color:'var(--accent)'}}>Entrar na minha conta</a></header>
 {tab==='painel'&&<LearningDashboard data={data} concurso={concurso} user={{displayName:'Aluno de demonstração'}} onNavigate={key=>setTab(nav.some(([id])=>id===key)?key:'planejamento')} onGoal={goal=>setData(d=>({...d,studyPreferences:{...d.studyPreferences,weeklyQuestionsGoal:goal}}))} onComplete={(ref,result)=>setData(d=>completeLearningSession(d,'demo',ref,todayISO(),result))}/>}
 {tab==='desempenho'&&<PerformanceView data={data} concurso={concurso} onRegister={register}/>}
 {tab==='alertas'&&<AlertsView data={data} concurso={concurso} onStudy={()=>setTab('painel')}/>}
 {tab==='planejamento'&&<PlanningView data={data} concurso={concurso} onSave={(draft,hours)=>{const materias=draft.materias.map(m=>({...m,topics:m.topics.map(({crossStudy,...t})=>t)}));const next={...data,concursos:[{...data.concursos[0],materias,learningBalance:draft.learningBalance}],studyPreferences:{...data.studyPreferences,dailyHours:Object.fromEntries(Object.entries(hours).map(([day,n])=>[day,Number(n)]))}};validatePlanData(next);setData(next);}}/>}
 {tab==='revisao'&&<ExternalReviewView data={data} concurso={concurso} onAdd={e=>setData(d=>({...d,externalReviews:[...d.externalReviews,e]}))} onReview={(id,rating)=>setData(d=>reviewExternalEntry(d,id,rating,todayISO()))} onRemove={id=>setData(d=>({...d,externalReviews:d.externalReviews.map(e=>e.id===id?{...e,archived:!e.archived}:e)}))}/>}
 {tab==='marcacoes'&&<MarksView data={data} concurso={concurso} onReview={(id,r)=>setData(d=>reviewStudyMark(d,"studyMarks",id,r,todayISO()))} onAdd={e=>setData(d=>({...d,studyMarks:[...d.studyMarks,e]}))} onRemove={id=>setData(d=>({...d,studyMarks:d.studyMarks.map(e=>e.id===id?{...e,archived:!e.archived}:e)}))}/>}
 {tab==='avulsas'&&<NotebookCatalogView data={data} concurso={concurso} onAdd={e=>setData(d=>({...d,questionNotebooks:[...(d.questionNotebooks||[]),e]}))} onRemove={id=>setData(d=>({...d,questionNotebooks:(d.questionNotebooks||[]).filter(e=>e.id!==id)}))}/>}
 {tab==='avulsas'&&<QuestionHubView concurso={concurso} questionCounts={{}} onLinks={()=>{}} onMaterials={()=>{}} onAnswer={()=>{}}/>}
 {tab==='pdf'&&<PdfStudyView data={data} concurso={concurso} onReview={(id,r)=>setData(d=>reviewStudyMark(d,"pdfAnnotations",id,r,todayISO()))} onAdd={e=>setData(d=>({...d,pdfAnnotations:[...(d.pdfAnnotations||[]),e]}))} onRemove={id=>setData(d=>({...d,pdfAnnotations:(d.pdfAnnotations||[]).filter(e=>e.id!==id)}))}/>}
 {tab==='ferramentas'&&<StudyToolsView data={data} concurso={concurso} onImport={marks=>setData(d=>({...d,studyMarks:[...d.studyMarks,...marks]}))} onCommunity={url=>setData(d=>({...d,studyPreferences:{...d.studyPreferences,communityUrl:url}}))}/>}
 <LearningHelp/></main></div>;
}

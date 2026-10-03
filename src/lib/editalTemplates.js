import { makeConcurso, PALETTE } from '../data/model.js';
import { uid } from './id.js';
import { validatePlanData } from './planValidation.js';
export const STARTER_TEMPLATES = [
  { name:'Modelo inicial · Área administrativa', banca:'', cargo:'', materias:[{name:'Língua Portuguesa',topics:[{name:'Interpretação de textos'},{name:'Concordância verbal e nominal'},{name:'Crase'}]},{name:'Direito Administrativo',topics:[{name:'Princípios da Administração Pública'},{name:'Atos administrativos'},{name:'Poderes administrativos'}]},{name:'Raciocínio Lógico',topics:[{name:'Proposições e conectivos'},{name:'Porcentagem'},{name:'Regra de três'}]}]},
  { name:'Modelo inicial · Tribunais', banca:'', cargo:'', materias:[{name:'Língua Portuguesa',topics:[{name:'Interpretação de textos'},{name:'Pontuação'},{name:'Regência verbal e nominal'}]},{name:'Direito Constitucional',topics:[{name:'Direitos e garantias fundamentais'},{name:'Organização do Estado'},{name:'Controle de constitucionalidade'}]},{name:'Direito Administrativo',topics:[{name:'Agentes públicos'},{name:'Atos administrativos'},{name:'Licitações e contratos'}]}]},
];
export function prepareEditalTemplate(raw) {
  if(!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.name !== 'string' || !raw.name.trim() || !Array.isArray(raw.materias) || !raw.materias.length) throw new Error('O modelo precisa de name e uma lista materias com assuntos.');
  if(raw.materias.length>200) throw new Error('Limite de 200 matérias por modelo.');
  const c=makeConcurso(raw.name.trim(),0);
  for(const key of ['banca','cargo','stage','editalUrl']) if(raw[key]!==undefined)c[key]=raw[key];
  c.examDate=raw.examDate || null;
  c.materias=raw.materias.map((m,i)=>{
    if(!m || typeof m.name !== 'string' || !Array.isArray(m.topics) || m.topics.length>1000)throw new Error('Cada matéria precisa de name e topics (até 1.000 assuntos).');
    return {id:uid(),name:m.name.trim(),color:PALETTE[i%PALETTE.length],topics:m.topics.map(t=>{
      if(!t || typeof t.name !== 'string')throw new Error('Cada assunto precisa de name.');
      return {id:uid(),name:t.name.trim(),status:'pendente',mastered:false,questionsTotal:0,questionsCorrect:0,reviewStep:0,nextReviewDate:null,notes:typeof t.notes==='string'?t.notes:'',...(t.link!==undefined?{link:t.link}:{}),...(t.links!==undefined?{links:t.links}:{}),...(t.materials!==undefined?{materials:Array.isArray(t.materials)?t.materials.map(a=>({...a,id:uid()})):t.materials}:{})};
    })};
  });
  validatePlanData({concursos:[c],activeConcursoId:c.id});
  return c;
}
export function exportEditalTemplate(c) {
  return {name:c.name,banca:c.banca || '',cargo:c.cargo || '',stage:c.stage || 'pre',examDate:c.examDate || null,editalUrl:c.editalUrl || '',materias:c.materias.map(m=>({name:m.name,topics:m.topics.map(t=>({name:t.name,notes:t.notes || '',...(t.links?{links:t.links}:{}),...(t.link?{link:t.link}:{}),materials:(t.materials || []).map(({name,url,type})=>({name,url,type}))}))}))};
}

export const TEC_ORIGIN='https://www.tecconcursos.com.br';
export const APP_ORIGIN='https://app.paulobruno.dev';
export const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function discipline(value){const n=normalize(value);return ['portugues','lingua portuguesa','lingua portuguesa portugues'].includes(n)?'portugues':n;}
export function validateTecRequest(value){
 if(!value||typeof value!=='object')throw Error('Pedido inválido.');
 const text=(key,max,optional=false)=>{const v=value[key];if(optional&&v==='')return '';if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`Confira ${key} do pedido.`);return v.trim();};
 const out={};for(const [key,max] of [['id',100],['accountId',200],['concursoId',200],['materiaId',200],['topicId',200],['materia',200],['subject',1000],['title',200]])out[key]=text(key,max);
 out.bank=text('bank',100,true);out.folder=text('folder',200,true);out.mappedTitle=text('mappedTitle',1500,true);
 if(!Number.isInteger(value.quantity)||value.quantity<1||value.quantity>1000)throw Error('Escolha de 1 a 1000 questões.');out.quantity=value.quantity;
 for(const key of ['yearFrom','yearTo']){if(value[key]!==null&&(!Number.isInteger(value[key])||value[key]<1900||value[key]>2100))throw Error('Confira os anos do caderno.');out[key]=value[key];}
 if((out.yearFrom===null)!==(out.yearTo===null)||out.yearFrom!==null&&out.yearFrom>out.yearTo)throw Error('Informe os dois anos em ordem ou deixe ambos vazios.');
 for(const key of ['onlyUnsolved','removeCancelled','removeOutdated']){if(typeof value[key]!=='boolean')throw Error('Confira as opções do caderno.');out[key]=value[key];}
 if(!Number.isSafeInteger(value.createdAt)||value.createdAt<=0)throw Error('Data do pedido inválida.');out.createdAt=value.createdAt;
 return out;
}
export function tecNotebookUrl(value){let url;try{url=new URL(value);}catch{throw Error('Link do caderno inválido.');}
 if(url.protocol!=='https:'||!['www.tecconcursos.com.br','tecconcursos.com.br'].includes(url.hostname)||url.username||url.password||url.port||!/^\/questoes\/cadernos\/[1-9]\d*\/?$/.test(url.pathname))throw Error('Use o endereço individual de um caderno do TEC.');
 return TEC_ORIGIN+url.pathname.replace(/\/$/,'');
}
export function bankMatches(actual,wanted){const a=normalize(actual),b=normalize(wanted);return a===b||['cespe','cebraspe','cebraspe cespe','cespe cebraspe'].includes(a)&&['cespe','cebraspe','cebraspe cespe','cespe cebraspe'].includes(b);}
export function subjectMatches(title,request){if(request.mappedTitle)return normalize(title)===normalize(request.mappedTitle);const colon=title.indexOf(':');if(colon<0)return false;const matter=title.slice(0,colon),topic=normalize(title.slice(colon+1)),wanted=normalize(request.subject);return discipline(matter)===discipline(request.materia)&&(topic===wanted||wanted.length>=20&&topic.includes(wanted));}
export function searchTerm(request){const title=request.mappedTitle?.split(':').slice(1).join(':')||request.subject;const clean=title.replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/,'').trim();return clean.split(/[;,()]/)[0].trim().slice(0,80)||clean.slice(0,80);}

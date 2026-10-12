(async()=>{
 if(location.origin!=='https://www.tecconcursos.com.br'||globalThis.__ritmoTecRunner)return;globalThis.__ritmoTecRunner=true;
 const send=async message=>{const response=await chrome.runtime.sendMessage(message);if(response?.error)throw Error(response.error);return response;};
 let job;for(let attempt=0;attempt<8&&!job;attempt++){job=(await send({type:'TEC_JOB'}))?.job;if(!job)await new Promise(r=>setTimeout(r,750));}if(!job)return;
 const {runTecBuilder}=await import(chrome.runtime.getURL('tec-dom.js'));
 await runTecBuilder(document,job,send);
})().catch(error=>{const box=document.createElement('div');box.textContent='Ritmo: '+error.message;Object.assign(box.style,{position:'fixed',right:'16px',bottom:'16px',padding:'16px',background:'#142633',color:'#fff',zIndex:'99999',maxWidth:'360px'});document.body.append(box);});

// This script is installed only on the platform's exact production origin.
(()=>{
 if(location.origin!=='https://app.paulobruno.dev'||globalThis.__ritmoTecBridge)return;globalThis.__ritmoTecBridge=true;
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='ritmo-tec-app-v1')return;
  const {type,request,accountId,id}=event.data;if(!['TEC_HELLO','TEC_CREATE','TEC_CANCEL'].includes(type))return;
  try{const response=await chrome.runtime.sendMessage({type,request,accountId,id});window.postMessage({channel:'ritmo-tec-extension-v1',type,id:request?.id||id,...response},location.origin);}
  catch(error){window.postMessage({channel:'ritmo-tec-extension-v1',type,id:request?.id||id,error:error.message},location.origin);}
 });
 chrome.runtime.onMessage.addListener(message=>{if(message.type==='TEC_RESULT')window.postMessage({channel:'ritmo-tec-extension-v1',type:'TEC_RESULT',result:message.result},location.origin);});
})();

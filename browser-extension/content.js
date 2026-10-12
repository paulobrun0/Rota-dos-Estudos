// Runs only after active-tab action or on an origin explicitly allowed by the user.
(async()=>{
 if(globalThis.__ritmoRestore){const saved=await chrome.storage.local.get('marks');globalThis.__ritmoRestore(saved.marks||[]);return;}
 const colors={yellow:'#ffe38a',green:'#b5efbd',pink:'#ffbfd5'};
 function restore(marks){for(const node of document.querySelectorAll('mark[data-ritmo-id]'))node.replaceWith(document.createTextNode(node.textContent));document.body.normalize();
   for(const mark of marks.filter(m=>m.url===location.href)){
     const nodes=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,textarea,input,select,button,[contenteditable="true"],mark[data-ritmo-id]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let text='',node;
     while((node=walker.nextNode())){nodes.push({node,start:text.length});text+=node.textContent;}
     const start=text.indexOf(mark.text);if(start<0||text.indexOf(mark.text,start+1)!==-1)continue; // Ambiguous passages are never highlighted automatically.
     const end=start+mark.text.length;
     for(const item of nodes.reverse()){const a=Math.max(0,start-item.start),b=Math.min(item.node.length,end-item.start);if(b<=a)continue;const selected=item.node.splitText(a);selected.splitText(b-a);const wrap=document.createElement('mark');wrap.dataset.ritmoId=mark.id;wrap.style.background=colors[mark.color]||colors.yellow;wrap.style.color='inherit';wrap.title=mark.note||'Grifo Ritmo';selected.replaceWith(wrap);wrap.append(selected);}
   }
 }
 globalThis.__ritmoRestore=restore;
 const stored=await chrome.storage.local.get('marks');restore(stored.marks||[]);
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.marks)restore(changes.marks.newValue||[]);});
})();

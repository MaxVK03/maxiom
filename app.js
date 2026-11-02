/* Maxiom — cloud-synced Markdown knowledge base */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const icon = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => Date.now();
  const initialSettings = { vim: true, lineNumbers: true, theme: 'dark' };
  const seedNotes = () => {
    const t = now();
    return [
      {id:uid(), title:'Welcome to Maxiom', folder:'Getting Started', favorite:true, createdAt:t-3000000, updatedAt:t-3000000, content:`## A little space for big ideas

Maxiom is your **cloud-synced knowledge base**, built for focused writing. Sign in on another computer to find the same notes.

### Make it yours

- Create a note using **Ctrl/Cmd + Shift + N**
- Open the command palette with **Ctrl/Cmd + K**
- Search your notes with **Ctrl/Cmd + P**
- Type [[Fourier Transform]] to link ideas together
- Use the **Graph** button to see your connections
- Your notes sync to your Maxiom account automatically
- Export a Markdown or JSON backup occasionally from **Settings**

### Mathematics, beautifully typeset

Inline math: $e^{i\\pi}+1=0$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx=\\sqrt{\\pi}
$$

### Designed for your keyboard

Vim is enabled by default. Try \`i\` to insert, \`Esc\` to return to normal mode, \`dd\` to delete a line, or \`/\` to search. Switch Vim off in Settings whenever you like.

> Maxiom saves your notes to your cloud account. You can open the same vault on multiple devices. Avoid editing the same vault simultaneously on different devices.
`},
      {id:uid(), title:'Fourier Transform', folder:'Mathematics', favorite:true, createdAt:t-2000000, updatedAt:t-2000000, content:`## From time to frequency

The continuous Fourier transform is

$$
\\hat f(\\xi) = \\int_{-\\infty}^{\\infty} f(x)e^{-2\\pi i x\\xi}\\,dx
$$

For a finite sequence of length $N$, the **discrete Fourier transform** is

$$
X_k = \\sum_{n=0}^{N-1} x_n e^{-2\\pi i kn/N},\\quad k=0,\\ldots,N-1.
$$

The FFT reduces the complexity from $O(N^2)$ to $O(N\\log N)$ for commonly used lengths.

### Important connections

- [[Compiler Correctness]] — optimizing the implementation
- [[Initial Algebras]] — structural recursion and folds

### Questions

- [ ] Compare radix-2 and mixed-radix FFT
- [ ] Derive the butterfly operation
`},
      {id:uid(), title:'Initial Algebras', folder:'University / Category Theory', favorite:false, createdAt:t-1800000, updatedAt:t-1800000, content:`## Catamorphisms

For an endofunctor $F$, an initial algebra $(\\mu F,\\mathsf{in})$ gives a unique algebra homomorphism into any $F$-algebra $(A,a)$.

$$
\\mathsf{cata}(a)\\circ\\mathsf{in}=a\\circ F(\\mathsf{cata}(a))
$$

This is a general form of structural recursion.

### Examples

- Lists: \`foldr\`
- Expressions: evaluation, pretty printing, substitution
- See [[Compiler Correctness]] for a program semantics connection

### Fusion law

When $h\\circ a=b\\circ F(h)$, we have:

$$h\\circ\\mathsf{cata}(a)=\\mathsf{cata}(b)$$
`},
      {id:uid(), title:'Compiler Correctness', folder:'University / Programming Languages', favorite:false, createdAt:t-1400000, updatedAt:t-1400000, content:`## Compilation to a stack machine

We want to establish that evaluation of an expression agrees with execution of the compiled instruction sequence.

$$
\\operatorname{eval}(e)=v \\implies \\operatorname{run}(\\operatorname{compile}(e),[] )=[v]
$$

### Proof sketch

1. Induction on the big-step derivation.
2. Prove a stronger continuation lemma.
3. Handle binary operations and conditional branches.

\`\`\`coq
Lemma compile_sound : forall e v,
  big_step e v ->
  vm_big_step (compile e) [] [v].
\`\`\`

Related: [[Initial Algebras]], [[Fourier Transform]]
`},
      {id:uid(), title:'Reading List', folder:'Personal', favorite:false, createdAt:t-900000, updatedAt:t-900000, content:`## Books and papers

- [ ] Read about the Curry–Howard correspondence
- [ ] Look into operational versus denotational semantics
- [ ] Explore graph-based personal knowledge management

### Thoughts

A good note should be **small, connected, and easy to revisit**.

Link useful ideas back to [[Initial Algebras]].
`}
    ];
  };

  const state = { notes: [], folders: [], activeId: null, selectedFolder: 'all', view: 'split', settings: {...initialSettings}, ready:false, bound:false, editor:null, currentModal:null, modalIndex:0, paletteItems:[], previewTimer:null, saveTimer:null, saving:false, suppress:false, toastTimer:null, client:null, user:null, cloudRevision:0, changeSerial:0, dirty:false, conflict:false, syncTimer:null, authBusy:false, recoveryMode:false };

  function openDatabase(){
    return new Promise((resolve, reject) => {
      if(!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open('axiom-vault', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function readVault(){
    try { const db = await openDatabase(); return await new Promise((resolve, reject) => { const tx=db.transaction('data','readonly'); const req=tx.objectStore('data').get('vault'); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); tx.oncomplete=()=>db.close(); }); }
    catch { try {return JSON.parse(localStorage.getItem('axiom-vault'));} catch{return null;} }
  }
  function snapshot(){ return {version:2,notes:state.notes,folders:state.folders,activeId:state.activeId,view:state.view,settings:state.settings}; }
  function setSaveStatus(label, status='ok'){
    const dot=status==='error'?'#e5a69d':status==='pending'?'#e4bd83':'var(--green)';
    $('saveStatus').innerHTML=`<span class="saved-dot" style="background:${dot}"></span> ${escapeHtml(label)}`;
  }
  function localRecoveryKey(){return state.user?`maxiom-unsynced-${state.user.id}`:null;}
  function stashUnsynced(){const key=localRecoveryKey();if(key){try{sessionStorage.setItem(key,JSON.stringify(snapshot()));}catch{}}}
  function clearUnsynced(){const key=localRecoveryKey();if(key){try{sessionStorage.removeItem(key);}catch{}}}
  function saveSoon(){
    if(!state.ready||!state.user)return;
    state.dirty=true;state.changeSerial++;
    stashUnsynced();setSaveStatus('Saving to cloud…','pending');
    clearTimeout(state.saveTimer);
    state.saveTimer=setTimeout(saveNow,850);
  }
  async function saveNow(){
    clearTimeout(state.saveTimer);
    if(!state.ready||!state.user||!state.dirty||state.conflict||state.saving)return;
    const userId=state.user.id,serial=state.changeSerial,expected=state.cloudRevision;
    const payload=snapshot();state.saving=true;
    try{
      let response;
      if(expected===0){
        response=await state.client.from('maxiom_vaults')
          .insert({user_id:userId,data:payload,revision:1}).select('revision').single();
      }else{
        response=await state.client.from('maxiom_vaults')
          .update({data:payload,revision:expected+1}).eq('user_id',userId)
          .eq('revision',expected).select('revision').maybeSingle();
      }
      if(state.user?.id!==userId)return;
      if(response.error){
        if(response.error.code==='23505'){
          showSyncConflict();return;
        }
        throw response.error;
      }
      if(!response.data){showSyncConflict();return;}
      state.cloudRevision=Number(response.data.revision);
      if(state.changeSerial===serial){state.dirty=false;clearUnsynced();setSaveStatus('Saved to cloud');}
      else setSaveStatus('Saving to cloud…','pending');
    }catch(error){
      console.warn('Cloud save error',error);
      if(state.user?.id===userId){setSaveStatus('Offline · changes pending','error');stashUnsynced();}
    }finally{
      state.saving=false;
      if(state.dirty&&!state.conflict&&state.user?.id===userId){
        clearTimeout(state.saveTimer);state.saveTimer=setTimeout(saveNow,3500);
      }
    }
  }
  function loadSnapshot(data){
    state.notes=Array.isArray(data?.notes)?data.notes.filter(n=>n&&typeof n.title==='string'&&typeof n.content==='string'):[];
    state.folders=Array.isArray(data?.folders)?data.folders.filter(f=>typeof f==='string'):[];
    state.settings={...initialSettings,...(data?.settings||{})};
    state.activeId=data?.activeId;
    state.view=['editor','split','preview'].includes(data?.view)?data.view:'split';
    if(!state.notes.length){state.notes=seedNotes();state.folders=fullFolders();state.activeId=state.notes[0].id;}
    if(!state.notes.some(n=>n.id===state.activeId))state.activeId=state.notes[0].id;
    document.body.dataset.theme=state.settings.theme==='light'?'light':'dark';
    $('themeBtn').innerHTML=icon(state.settings.theme==='dark'?'sun':'moon');
    renderSidebar();renderNote();
  }
  async function fetchCloudVault(){
    const {data,error}=await state.client.from('maxiom_vaults')
      .select('data,revision').eq('user_id',state.user.id).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function checkCloud(){
    if(!state.user||!state.ready||state.conflict||state.saving)return;
    if(state.dirty){await saveNow();return;}
    try{
      const row=await fetchCloudVault();
      if(!state.ready||!state.user||state.dirty||state.saving)return;
      const revision=Number(row?.revision||0);
      if(revision!==state.cloudRevision){
        state.cloudRevision=revision;
        if(row?.data){loadSnapshot(row.data);setSaveStatus('Synced from cloud');toast('Updated from another device');}
      }
    }catch(error){console.warn('Cloud check error',error);setSaveStatus('Cloud unreachable','error');}
  }
  function showSyncConflict(){
    state.conflict=true;stashUnsynced();setSaveStatus('Sync conflict · action required','error');
    openDialog(`<div class="modal-page"><h2>Cloud changes detected</h2><p>Another device updated your notes while you were editing. Your local edits have <strong>not</strong> overwritten the cloud. Download a JSON backup to protect your work, then choose which version to keep.</p><div class="settings-actions"><button class="primary-btn" id="conflictBackup">Download my edits</button><button class="secondary-btn" id="conflictReload">Use cloud version</button><button class="danger-btn" id="conflictOverwrite">Replace cloud version</button></div></div>`,'conflict');
    $('conflictBackup').onclick=exportBackup;
    $('conflictReload').onclick=async()=>{
      try{const row=await fetchCloudVault();if(!row)throw Error('Cloud vault missing');state.cloudRevision=Number(row.revision);state.dirty=false;state.conflict=false;clearUnsynced();loadSnapshot(row.data);closeModal();setSaveStatus('Synced from cloud');}
      catch(error){toast(`Could not reload: ${error.message}`);}
    };
    $('conflictOverwrite').onclick=async()=>{
      if(!confirm('Replace the newer cloud vault with this device’s notes? Export a backup first if unsure.'))return;
      try{const row=await fetchCloudVault();state.cloudRevision=Number(row?.revision||0);state.conflict=false;closeModal();state.dirty=true;state.changeSerial++;await saveNow();}
      catch(error){state.conflict=true;toast(`Unable to sync: ${error.message}`);showSyncConflict();}
    };
  }
  function activeNote(){return state.notes.find(n=>n.id===state.activeId) ?? null;}
  function fullFolders(){ return [...new Set([...state.folders,...state.notes.map(n=>n.folder).filter(Boolean)])].sort((a,b)=>a.localeCompare(b)); }
  function tagsOf(note){return [...new Set(Array.from(note.content.matchAll(/(?:^|\s)#([A-Za-z][\w-]*)\b/g),m=>m[1].toLowerCase()))].slice(0,5);}
  function wikiLinks(text){return [...new Set(Array.from(text.matchAll(/\[\[([^\]\n]+)\]\]/g),m=>m[1].split('|')[0].trim()))];}
  function resolveNote(title){return state.notes.find(n=>n.title.toLocaleLowerCase()===title.toLocaleLowerCase());}
  function formatDate(ms){return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(ms);}
  function toast(message){ const e=$('toast');e.textContent=message;e.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>e.classList.remove('show'),2500); }
  function downloadBlob(blob,filename){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function safeFileName(name){return name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().slice(0,120)||'Untitled';}
  function noteMarkdown(n){return `# ${n.title}\n\n${n.content.trim()}\n`;}
  function generateZip(files){
    const enc=new TextEncoder(), chunks=[], central=[];let offset=0;
    const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
    const crc32=(data)=>{let c=0xffffffff;for(const x of data)c=table[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
    function push(bytes){chunks.push(bytes);offset+=bytes.length;}
    const u16=(dv,i,v)=>dv.setUint16(i,v,true),u32=(dv,i,v)=>dv.setUint32(i,v,true);
    for(const [filename,content] of files){
      const name=enc.encode(filename),data=enc.encode(content),crc=crc32(data),start=offset;
      const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
      u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0800);u16(v,8,0);u32(v,14,crc);u32(v,18,data.length);u32(v,22,data.length);u16(v,26,name.length);local.set(name,30);push(local);push(data);
      const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u32(cv,42,start);c.set(name,46);central.push(c);
    }
    const centralStart=offset;for(const c of central)push(c);const end=new Uint8Array(22),ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,8,central.length);u16(ev,10,central.length);u32(ev,12,offset-centralStart);u32(ev,16,centralStart);push(end);
    return new Blob(chunks,{type:'application/zip'});
  }
  function exportAllMarkdown(){
    const used=new Set();const files=state.notes.map(n=>{let path=(n.folder?n.folder.split('/').map(s=>safeFileName(s.trim())).join('/')+'/':'')+safeFileName(n.title);let final=path+'.md',i=2;while(used.has(final)){final=`${path} (${i++}).md`;}used.add(final);return [final,noteMarkdown(n)];});
    downloadBlob(generateZip(files),'maxiom-notes.zip');toast(`Exported ${files.length} Markdown notes`);
  }
  function exportBackup(){ downloadBlob(new Blob([JSON.stringify({...snapshot(),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),'maxiom-vault-backup.json');toast('Vault backup downloaded'); }
  function exportCurrent(){const n=activeNote();if(n){downloadBlob(new Blob([noteMarkdown(n)],{type:'text/markdown'}),`${safeFileName(n.title)}.md`);toast('Markdown note downloaded');}}

  function renderSidebar(){
    const total=state.notes.length,favorites=state.notes.filter(n=>n.favorite).length;
    $('workspaceNav').innerHTML=[['all','grid','All notes',total],['favorites','star','Favorites',favorites]].map(([key,ic,label,count])=>`<button class="nav-item ${state.selectedFolder===key?'active':''}" data-folder="${key}">${icon(ic)}<span class="label">${label}</span><span class="count">${count}</span></button>`).join('');
    $('folderNav').innerHTML=fullFolders().map(f=>`<button class="nav-item ${state.selectedFolder===f?'active':''}" data-folder="${escapeHtml(f)}">${icon('folder')}<span class="label" title="${escapeHtml(f)}">${escapeHtml(f)}</span><span class="count">${state.notes.filter(n=>n.folder===f).length}</span></button>`).join('')||'<span class="right-empty" style="padding:10px">No folders yet</span>';
    const recent=[...state.notes].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,7);
    $('recentNav').innerHTML=recent.map(n=>`<button class="nav-item recent ${state.activeId===n.id?'active':''}" data-note-id="${escapeHtml(n.id)}">${icon('file')}<span class="label" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</span></button>`).join('');
    $('statusNoteCount').textContent=`${state.notes.length} notes`;
  }
  function renderBreadcrumb(){const n=activeNote();$('breadcrumb').innerHTML=n?`<span>${escapeHtml(n.folder||'Unfiled')}</span><span class="slash">/</span><b>${escapeHtml(n.title)}</b>`:'<b>All notes</b>';}
  function renderMeta(){
    const n=activeNote();if(!n)return;
    $('folderLabel').textContent=n.folder||'Unfiled';$('noteTitle').value=n.title;
    $('modifiedDate').textContent=`Edited ${formatDate(n.updatedAt)}`;
    const words=n.content.trim()?n.content.trim().split(/\s+/).length:0;
    $('wordCount').textContent=`${words} words`;
    const tags=tagsOf(n);$('noteTags').innerHTML=tags.length?tags.map(tag=>`<span class="tag-chip">#${escapeHtml(tag)}</span>`).join(''):'Markdown · LaTeX';
    $('favoriteBtn').classList.toggle('favorited',!!n.favorite);$('favoriteBtn').innerHTML=icon('star');
    renderBreadcrumb();
  }
  function renderViewTabs(){
    const tabs=[['editor','code','Editor'],['split','split','Split view'],['preview','eye','Preview']];
    $('viewSwitch').innerHTML=tabs.map(([id,ic,label])=>`<button data-view="${id}" class="view-tab ${state.view===id?'active':''}">${icon(ic)}<span>${label}</span></button>`).join('');
    $('workspace').dataset.view=state.view;
    setTimeout(()=>state.editor?.refresh(),50);
  }
  function renderNote(){
    const n=activeNote();if(!n)return;
    renderMeta();renderViewTabs();
    if(!state.editor) initializeEditor();
    if(state.editor.getValue()!==n.content){ state.suppress=true;state.editor.setValue(n.content);state.editor.clearHistory();state.suppress=false; }
    state.editor.setOption('keyMap',state.settings.vim?'vim':'default');state.editor.setOption('lineNumbers',state.settings.lineNumbers);
    renderPreview();renderRight();
    const mode = state.settings.vim?'NORMAL':'EDIT';$('vimStatus').textContent=mode;$('vimStatus').className=`vim-status ${state.settings.vim?'':'off'}`;
    $('editorModeLabel').textContent=state.settings.vim?'VIM ENABLED':'STANDARD KEYBINDINGS';
  }
  function initializeEditor(){
    const cm=CodeMirror($('editorMount'),{
      value:activeNote()?.content||'',mode:'gfm',theme:'default',lineWrapping:true,lineNumbers:state.settings.lineNumbers,
      keyMap:state.settings.vim?'vim':'default',matchBrackets:true,autoCloseBrackets:true,
      indentUnit:2,tabSize:2,styleActiveLine:true,foldGutter:true,
      gutters:['CodeMirror-linenumbers','CodeMirror-foldgutter'],
      extraKeys:{'Ctrl-S':()=>saveNow(),'Cmd-S':()=>saveNow(),'Ctrl-Shift-P':()=>openPalette('commands')}
    });
    state.editor=cm;
    cm.on('change',()=>{
      if(state.suppress)return;
      const n=activeNote();if(!n)return;
      n.content=cm.getValue();n.updatedAt=now();
      renderMeta();renderSidebar();renderRight();saveSoon();
      clearTimeout(state.previewTimer);state.previewTimer=setTimeout(renderPreview,150);
    });
    cm.on('cursorActivity',()=>{const p=cm.getCursor();$('cursorStatus').textContent=`Ln ${p.line+1}, Col ${p.ch+1}`;});
    cm.on('vim-mode-change',(_cm,mode)=>{
      const v=String(mode?.mode||'normal').toUpperCase();$('vimStatus').textContent=v;$('vimStatus').className=`vim-status ${v==='INSERT'||v==='REPLACE'?'insert':''}`;
    });
    try{CodeMirror.Vim.defineEx('write','w',()=>{saveNow();toast('Sync requested');});CodeMirror.Vim.defineEx('edit','e',()=>openPalette('notes'));}catch{}
    cm.refresh();
  }
  function chooseNote(id){
    if(!state.notes.some(n=>n.id===id))return;
    state.activeId=id;
    renderSidebar();renderNote();saveSoon();closeModal();
    if(window.innerWidth<=650)$('app').classList.add('sidebar-hidden');
  }
  function newNote(folder){
    const path=folder??(!['all','favorites'].includes(state.selectedFolder)?state.selectedFolder:'Inbox');
    if(path&&!state.folders.includes(path))state.folders.push(path);
    const n={id:uid(),title:'Untitled',folder:path,favorite:false,createdAt:now(),updatedAt:now(),content:''};
    state.notes.unshift(n);state.selectedFolder='all';chooseNote(n.id);$('noteTitle').focus();$('noteTitle').select();toast('New note created');
  }
  function updateTitle(){const n=activeNote();if(!n)return;const old=n.title;const next=$('noteTitle').value.trim()||'Untitled';if(old===next)return;n.title=next;n.updatedAt=now();
    for(const other of state.notes){if(other.id===n.id)continue;const escaped=old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');other.content=other.content.replace(new RegExp(`\\[\\[${escaped}\\]\\]`,'gi'),`[[${next}]]`);}
    renderSidebar();renderBreadcrumb();renderRight();renderPreview();saveSoon();}
  function selectFolder(folder){state.selectedFolder=folder;renderSidebar();
    const matches=state.notes.filter(n=>folder==='all'||(folder==='favorites'?n.favorite:n.folder===folder));
    if(matches.length){chooseNote([...matches].sort((a,b)=>b.updatedAt-a.updatedAt)[0].id);}else if(folder!=='favorites'){newNote(folder);}else toast('No favorites yet');
  }
  function newFolderModal(){openInputModal('Create a folder','Folder name, e.g. University / Mathematics','New folder',value=>{const f=value.trim();if(!f)return;if(!state.folders.includes(f))state.folders.push(f);state.selectedFolder=f;renderSidebar();saveSoon();toast(`Folder "${f}" created`);});}
  function moveNote(){const n=activeNote();if(!n)return;const folders=fullFolders();openDialog(`<div class="modal-page"><h2>Move note</h2><p>Choose a folder for <strong>${escapeHtml(n.title)}</strong>.</p><select id="moveFolder" class="input-field">${folders.map(f=>`<option value="${escapeHtml(f)}" ${f===n.folder?'selected':''}>${escapeHtml(f)}</option>`).join('')}<option value="__new__">+ Create a new folder</option></select><div class="modal-actions"><button class="secondary-btn" data-action="close">Cancel</button><button class="primary-btn" id="confirmMove">Move note</button></div></div>`,'move');$('confirmMove').onclick=()=>{let f=$('moveFolder').value;if(f==='__new__'){f=prompt('New folder name')?.trim();if(!f)return;}n.folder=f;if(!state.folders.includes(f))state.folders.push(f);n.updatedAt=now();closeModal();renderSidebar();renderNote();saveSoon();toast('Note moved');};}
  function deleteNote(){const n=activeNote();if(!n)return;openDialog(`<div class="modal-page"><h2>Delete this note?</h2><p>"${escapeHtml(n.title)}" will be permanently removed from your cloud vault. Export a backup first if needed.</p><div class="modal-actions"><button class="secondary-btn" data-action="close">Cancel</button><button class="danger-btn" id="confirmDelete">Delete note</button></div></div>`,'confirm');$('confirmDelete').onclick=()=>{state.notes=state.notes.filter(x=>x.id!==n.id);if(!state.notes.length){const blank={id:uid(),title:'Untitled',folder:'Inbox',favorite:false,createdAt:now(),updatedAt:now(),content:''};state.notes=[blank];}state.activeId=state.notes[0].id;closeModal();renderSidebar();renderNote();saveSoon();toast('Note deleted');};}
  function duplicateNote(){const n=activeNote();if(!n)return;const duplicate={...n,id:uid(),title:`${n.title} (copy)`,favorite:false,createdAt:now(),updatedAt:now()};state.notes.unshift(duplicate);chooseNote(duplicate.id);toast('Note duplicated');}

  function protectMath(source){
    const math=[];
    const sections=source.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
    const text=sections.map((section,i)=>{
      if(i%2===1)return section;
      const store=(tex,display)=>{const j=math.push({tex,display})-1;return `MAXIOMMATHTOKEN${j}END`;};
      return section.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g,(_m,tex)=>store(tex,true))
        .replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g,(_m,tex)=>store(tex,false));
    }).join('');
    return {text,math};
  }
  const allowedTags=new Set('p div span h1 h2 h3 h4 h5 h6 ul ol li strong em b i del s blockquote pre code hr br a img table thead tbody tr th td input sup sub'.split(' '));
  const dangerousTags=new Set(['script','style','iframe','object','embed','form','svg','math','template','video','audio','link','meta']);
  function safeUrl(url,forImage=false){
    try{const val=(url||'').trim();if(!val)return false;if(val.startsWith('//'))return false;if(val.startsWith('#')&&!forImage)return true;
      const u=new URL(val,window.location.href);return ['http:','https:'].includes(u.protocol)||(!forImage&&u.protocol==='mailto:');
    }catch{return false;}
  }
  function sanitizeMarkdown(html){
    const doc=new DOMParser().parseFromString(`<div id="root">${html}</div>`,'text/html');
    function clone(node){
      if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);
      if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
      const tag=node.tagName.toLowerCase();if(dangerousTags.has(tag))return document.createDocumentFragment();
      if(!allowedTags.has(tag)){const frag=document.createDocumentFragment();for(const child of [...node.childNodes])frag.append(clone(child));return frag;}
      const output=document.createElement(tag);
      if(tag==='a'&&safeUrl(node.getAttribute('href'))) {output.setAttribute('href',node.getAttribute('href'));output.setAttribute('target','_blank');output.setAttribute('rel','noopener noreferrer');}
      if(tag==='img'&&safeUrl(node.getAttribute('src'),true)){output.setAttribute('src',node.getAttribute('src'));output.setAttribute('loading','lazy');output.setAttribute('alt',node.getAttribute('alt')||'');}
      if(tag==='input'&&node.getAttribute('type')==='checkbox'){output.setAttribute('type','checkbox');if(node.checked||node.hasAttribute('checked'))output.checked=true;output.disabled=true;}
      if(tag==='code'&&/^language-[a-z\d_+-]+$/i.test(node.getAttribute('class')||''))output.className=node.getAttribute('class');
      for(const child of [...node.childNodes])output.append(clone(child));return output;
    }
    const frag=document.createDocumentFragment();for(const child of [...doc.getElementById('root').childNodes])frag.append(clone(child));return frag;
  }
  function mathNode(entry){
    const root=document.createElement(entry.display?'div':'span');root.className=entry.display?'math-block':'math-inline';
    if(window.MathJax?.tex2svg){try{const svg=MathJax.tex2svg(entry.tex.trim(),{display:entry.display});root.append(svg);}catch(error){root.className='math-error';root.textContent=error.message;}}
    else root.textContent=entry.display?`$$${entry.tex}$$`:`$${entry.tex}$`;
    return root;
  }
  function decoratePreview(content,math){
    const iterator=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);const nodes=[];while(iterator.nextNode())nodes.push(iterator.currentNode);
    for(const node of nodes){
      if(node.parentElement?.closest('pre,code,a'))continue;
      const text=node.textContent;const re=/MAXIOMMATHTOKEN(\d+)END|\[\[([^\]\n]+)\]\]/g;
      if(!re.test(text))continue;re.lastIndex=0;
      let m,last=0;const frag=document.createDocumentFragment();
      while((m=re.exec(text))){if(m.index>last)frag.append(document.createTextNode(text.slice(last,m.index)));
        if(m[1]!==undefined){const entry=math[Number(m[1])];frag.append(entry?mathNode(entry):document.createTextNode(m[0]));}
        else {const [name,alias]=m[2].split('|'),target=resolveNote(name.trim()),link=document.createElement('a');link.className=`wiki-link ${target?'':'wiki-missing'}`;link.textContent=(alias||name).trim();link.href='#';link.dataset.wikiTitle=name.trim();link.title=target?'Open linked note':'Create linked note';frag.append(link);}
        last=re.lastIndex;
      }
      if(last<text.length)frag.append(document.createTextNode(text.slice(last)));node.replaceWith(frag);
    }
    [...content.querySelectorAll('h1,h2,h3,h4')].forEach((h,i)=>{h.dataset.headingIndex=String(i);});
  }
  function renderPreview(){
    const n=activeNote();if(!n)return;const target=$('previewContent');const {text,math}=protectMath(n.content);
    let html='';try{html=marked.parse?marked.parse(text,{gfm:true,breaks:false}):marked(text);}catch{html='<p>Preview unavailable.</p>';}
    target.replaceChildren(sanitizeMarkdown(html));decoratePreview(target,math);
  }
  function renderRight(){
    const n=activeNote();if(!n)return;
    const headings=[...n.content.matchAll(/^(#{1,3})\s+(.+)$/gm)].map(m=>({level:m[1].length,label:m[2].replace(/\*|`|\[/g,'').slice(0,75)}));
    const outgoing=wikiLinks(n.content),incoming=state.notes.filter(other=>other.id!==n.id&&wikiLinks(other.content).some(title=>title.toLowerCase()===n.title.toLowerCase()));
    $('rightContent').innerHTML=`
      <section class="right-block"><h3 class="right-header">ON THIS PAGE</h3>${headings.length?headings.map((h,i)=>`<button class="outline-item h${h.level}" data-heading="${i}" title="${escapeHtml(h.label)}">${escapeHtml(h.label)}</button>`).join(''):'<p class="right-empty">Add headings using ## to build an outline.</p>'}</section>
      <section class="right-block"><h3 class="right-header">${icon('link','tiny')} &nbsp; BACKLINKS <span style="color:var(--accent)">(${incoming.length})</span></h3>${incoming.length?incoming.map(x=>`<button class="context-note" data-note-id="${escapeHtml(x.id)}">${icon('file','small')}<span>${escapeHtml(x.title)}</span></button>`).join(''):'<p class="right-empty">No notes link here yet.</p>'}</section>
      <section class="right-block"><h3 class="right-header">OUTGOING LINKS <span style="color:var(--accent)">(${outgoing.length})</span></h3>${outgoing.length?outgoing.map(title=>`<button class="context-note" data-wiki-title="${escapeHtml(title)}">${icon(resolveNote(title)?'link':'plus','small')}<span>${escapeHtml(title)}</span></button>`).join(''):'<p class="right-empty">Link notes with [[double brackets]].</p>'}</section>
      <div class="right-tip"><div class="right-tip-title">${icon('command')} A little tip</div><p>Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to open the command palette. Your keyboard is the fastest way around.</p></div>`;
  }
  function openWiki(title){const match=resolveNote(title);if(match)chooseNote(match.id);else {newNote();$('noteTitle').value=title;updateTitle();toast(`Created "${title}"`);}}
  function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'light':'dark';document.body.dataset.theme=state.settings.theme;$('themeBtn').innerHTML=icon(state.settings.theme==='dark'?'sun':'moon');saveSoon();}
  function setView(view){state.view=view;renderViewTabs();saveSoon();}
  function insertMath(){const cm=state.editor;if(!cm)return;setView('split');cm.focus();const selected=cm.getSelection();cm.replaceSelection(selected?`$${selected}$`:'$$\n\\frac{a}{b}\n$$','around');}

  function openDialog(inner,kind){state.currentModal=kind;$('modalContent').innerHTML=inner;$('modalOverlay').classList.remove('hidden');$('modalOverlay').setAttribute('aria-hidden','false');}
  function closeModal(){state.currentModal=null;$('modalOverlay').classList.add('hidden');$('modalOverlay').setAttribute('aria-hidden','true');$('modalContent').replaceChildren();}
  function openInputModal(title,description,action,callback){
    openDialog(`<div class="modal-page"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><form id="inputForm"><input id="modalInput" class="input-field" autocomplete="off" required><div class="modal-actions"><button type="button" class="secondary-btn" data-action="close">Cancel</button><button type="submit" class="primary-btn">${escapeHtml(action)}</button></div></form></div>`,'input');
    $('inputForm').onsubmit=e=>{e.preventDefault();const value=$('modalInput').value;closeModal();callback(value);};$('modalInput').focus();
  }
  function actions(){return[
    {label:'Create new note',hint:'New markdown document',icon:'plus',shortcut:'Ctrl Shift N',do:()=>newNote()},
    {label:'Search all notes',hint:'Quickly jump between your notes',icon:'search',shortcut:'Ctrl P',do:()=>openPalette('notes')},
    {label:'Show knowledge graph',hint:'Visualize connected ideas',icon:'graph',do:openGraph},
    {label:'Toggle Vim keybindings',hint:'Switch modal editing on or off',icon:'code',do:()=>{state.settings.vim=!state.settings.vim;renderNote();saveSoon();toast(`Vim ${state.settings.vim?'enabled':'disabled'}`);}},
    {label:'Toggle dark / light theme',hint:'Change the appearance',icon:'sun',do:toggleTheme},
    {label:'Editor view',hint:'Markdown source only',icon:'code',do:()=>setView('editor')},
    {label:'Split editor & preview',hint:'Live mathematical notation',icon:'split',do:()=>setView('split')},
    {label:'Reading view',hint:'Rendered Markdown and math',icon:'eye',do:()=>setView('preview')},
    {label:'Insert LaTeX equation',hint:'Create a display math block',icon:'hash',do:insertMath},
    {label:'Create folder',hint:'Organize your notes',icon:'folder',do:newFolderModal},
    {label:'Download Markdown vault',hint:'Export all notes as a ZIP',icon:'download',do:exportAllMarkdown},
    {label:'Download vault backup',hint:'Export notes and settings as JSON',icon:'download',do:exportBackup},
    {label:'Import notes',hint:'Load Markdown or JSON backup',icon:'upload',do:()=>$('importInput').click()},
    {label:'Open settings',hint:'Manage editing and storage',icon:'settings',do:openSettings},
  ];}
  function openPalette(kind='commands'){
    state.currentModal=kind;state.modalIndex=0;
    const heading=kind==='notes'?'Search notes by name, folder, or content…':'Search notes or type a command…';
    openDialog(`<div class="modal-search">${icon('search','large')}<input id="paletteInput" placeholder="${heading}" autocomplete="off" aria-label="Command search"><kbd>ESC</kbd></div><div class="modal-list" id="paletteResults"></div><div class="modal-foot"><span><kbd>↑↓</kbd> to navigate</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>`,kind);
    $('paletteInput').addEventListener('input',()=>{state.modalIndex=0;renderPalette();});
    $('paletteInput').addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'){e.preventDefault();state.modalIndex=Math.min(state.modalIndex+1,state.paletteItems.length-1);renderPalette();}
      if(e.key==='ArrowUp'){e.preventDefault();state.modalIndex=Math.max(state.modalIndex-1,0);renderPalette();}
      if(e.key==='Enter'){e.preventDefault();runPaletteItem(state.modalIndex);}
    });
    renderPalette();$('paletteInput').focus();
  }
  function renderPalette(){
    const input=$('paletteInput');if(!input)return;const q=input.value.toLowerCase().trim();
    const noteItems=state.notes.filter(n=>`${n.title} ${n.folder} ${n.content}`.toLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt).map(n=>({label:n.title,hint:n.folder||'Unfiled',icon:'file',do:()=>chooseNote(n.id)}));
    const commandItems=actions().filter(x=>!q||`${x.label} ${x.hint}`.toLowerCase().includes(q));
    state.paletteItems=state.currentModal==='notes'?noteItems:[...commandItems,...(q?noteItems:noteItems.slice(0,5))];
    state.paletteItems=state.paletteItems.slice(0,35);
    $('paletteResults').innerHTML=state.paletteItems.length?state.paletteItems.map((item,i)=>`<div class="palette-row ${i===state.modalIndex?'selected':''}" data-palette-index="${i}"><span class="palette-icon">${icon(item.icon)}</span><span class="palette-main"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.hint)}</small></span>${item.shortcut?`<span class="palette-key">${escapeHtml(item.shortcut)}</span>`:''}</div>`).join(''):'<p class="right-empty" style="padding:22px">No matching notes or commands.</p>';
    $('paletteResults').querySelector('.selected')?.scrollIntoView({block:'nearest'});
  }
  function runPaletteItem(i){const item=state.paletteItems[i];if(!item)return;closeModal();item.do();}
  function openSettings(){
    openDialog(`<div class="modal-page"><h2>Workspace settings</h2><p>Signed in as <strong>${escapeHtml(state.user?.email||'')}</strong>. Your notes sync through Supabase.</p>
      <div class="divider"></div>
      <div class="settings-row"><div><strong>Vim keybindings</strong><small>Use normal, insert, visual modes and Vim motions.</small></div><button class="toggle ${state.settings.vim?'on':''}" data-setting="vim" aria-label="Toggle Vim"></button></div>
      <div class="settings-row"><div><strong>Line numbers</strong><small>Display source line numbers beside the editor.</small></div><button class="toggle ${state.settings.lineNumbers?'on':''}" data-setting="lineNumbers" aria-label="Toggle line numbers"></button></div>
      <div class="settings-row"><div><strong>Dark appearance</strong><small>Switch between dark and light themes.</small></div><button class="toggle ${state.settings.theme==='dark'?'on':''}" data-setting="theme" aria-label="Toggle dark theme"></button></div>
      <div class="divider"></div><h2 style="font-size:17px">Cloud & backups</h2><p>Your account stores notes in a private Supabase vault with per-user database access controls. Export regular backups. Concurrent editing on different devices can require conflict resolution.</p>
      <div class="settings-actions"><button class="primary-btn" id="settingsZip">${icon('download')} Export Markdown ZIP</button><button class="secondary-btn" id="settingsBackup">JSON backup</button><button class="secondary-btn" id="settingsImport">Import notes</button><button class="secondary-btn" id="settingsSync">Sync now</button><button class="danger-btn" id="settingsLogout">Sign out</button></div>
    </div>`,'settings');
    $('settingsZip').onclick=exportAllMarkdown;$('settingsBackup').onclick=exportBackup;
    $('settingsImport').onclick=()=>$('importInput').click();
    $('settingsSync').onclick=async()=>{closeModal();if(state.dirty)await saveNow();await checkCloud();};
    $('settingsLogout').onclick=signOut;
  }
  function openNoteActions(){openDialog(`<div class="modal-page"><h2>Note actions</h2><p>Manage <strong>${escapeHtml(activeNote()?.title)}</strong>.</p><div class="settings-actions"><button class="secondary-btn" data-note-action="download">${icon('download')} Download Markdown</button><button class="secondary-btn" data-note-action="duplicate">${icon('file')} Duplicate note</button><button class="secondary-btn" data-note-action="move">${icon('folder')} Move to folder</button><button class="danger-btn" data-note-action="delete">${icon('trash')} Delete note</button></div></div>`,'actions');}
  function openGraph(){
    const nodes=state.notes.slice(0,80),n=nodes.length;if(!n)return;const w=540,h=420,cx=w/2,cy=h/2;
    const radius=n<=3?105:n<=10?147:160;
    const positions=new Map(nodes.map((note,i)=>[note.id,{x:cx+radius*Math.cos(2*Math.PI*i/n-Math.PI/2),y:cy+radius*.9*Math.sin(2*Math.PI*i/n-Math.PI/2)}]));
    const connections=[];for(const source of nodes){for(const title of wikiLinks(source.content)){const target=resolveNote(title);if(target&&positions.has(target.id)&&target.id!==source.id)connections.push([source.id,target.id]);}}
    const edges=connections.map(([a,b])=>`<line class="graph-edge" x1="${positions.get(a).x}" y1="${positions.get(a).y}" x2="${positions.get(b).x}" y2="${positions.get(b).y}"/>`).join('');
    const circles=nodes.map(note=>{const {x,y}=positions.get(note.id);return `<g class="graph-node ${note.id===state.activeId?'selected':''}" data-graph-id="${escapeHtml(note.id)}"><circle cx="${x}" cy="${y}" r="${note.id===state.activeId?10:7}"/><text x="${x}" y="${y+23}">${escapeHtml(note.title.length>22?note.title.slice(0,21)+'…':note.title)}</text></g>`;}).join('');
    openDialog(`<div class="modal-page"><h2>Knowledge graph</h2><p>${nodes.length} notes · ${connections.length} connections. Select a node to open the note.</p><div class="graph-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Knowledge graph of linked notes">${edges}${circles}</svg></div></div>`,'graph');
  }
  async function importFiles(files){
    let count=0,backup=false;for(const file of files){
      if(file.size>15_000_000){toast(`Skipped oversized file: ${file.name}`);continue;}
      let text;try{text=await file.text();}catch{continue;}
      if(file.name.toLowerCase().endsWith('.json')){
        try{const v=JSON.parse(text);if(!Array.isArray(v.notes)||!v.notes.every(n=>typeof n.title==='string'&&typeof n.content==='string'))throw Error('Invalid vault');
          const known=new Set(state.notes.map(n=>n.id));for(const item of v.notes){const n={id:known.has(item.id)?uid():String(item.id||uid()),title:item.title,folder:typeof item.folder==='string'?item.folder:'Imported',favorite:!!item.favorite,createdAt:Number(item.createdAt)||now(),updatedAt:Number(item.updatedAt)||now(),content:item.content};known.add(n.id);state.notes.push(n);count++;}
          for(const f of Array.isArray(v.folders)?v.folders:[]){if(typeof f==='string'&&!state.folders.includes(f))state.folders.push(f);}backup=true;
        }catch{toast(`Not a valid Maxiom backup: ${file.name}`);}continue;
      }
      if(!/\.(md|markdown)$/.test(file.name.toLowerCase()))continue;
      const match=text.match(/^#\s+(.+)\r?\n/);const title=match?match[1].trim():file.name.replace(/\.(md|markdown)$/i,'');
      const body=match?text.slice(match[0].length).replace(/^\s*\n/,''):text;
      const note={id:uid(),title,folder:'Imported',favorite:false,createdAt:now(),updatedAt:now(),content:body};state.notes.push(note);count++;
    }
    if(count){state.activeId=state.notes[state.notes.length-1].id;state.selectedFolder='all';renderSidebar();renderNote();saveSoon();closeModal();toast(`Imported ${count} notes${backup?' from backup':''}`);}else toast('No supported notes found');
  }
  function toggleSidebar(){$('app').classList.toggle('sidebar-hidden');setTimeout(()=>state.editor?.refresh(),200);}
  function toggleRight(){$('app').classList.toggle('right-hidden');setTimeout(()=>state.editor?.refresh(),200);}
  function bindEvents(){
    $('searchTrigger').innerHTML=`${icon('search')}<span>Search anything...</span><kbd>Ctrl K</kbd>`;
    $('newNote').innerHTML=icon('plus');$('newFolder').innerHTML=icon('plus');$('sidebarSettings').innerHTML=icon('settings');
    $('closeSidebar').innerHTML=icon('x');$('toggleSidebar').innerHTML=icon('panel');$('toggleRight').innerHTML=icon('panel');
    $('graphBtn').innerHTML=icon('graph');$('moreBtn').innerHTML=icon('menu');$('themeBtn').innerHTML=icon(state.settings.theme==='dark'?'sun':'moon');
    $('searchTrigger').onclick=()=>openPalette('commands');$('newNote').onclick=()=>newNote();$('newFolder').onclick=newFolderModal;
    $('sidebarSettings').onclick=openSettings;$('closeSidebar').onclick=toggleSidebar;$('toggleSidebar').onclick=toggleSidebar;
    $('toggleRight').onclick=toggleRight;$('graphBtn').onclick=openGraph;$('themeBtn').onclick=toggleTheme;$('accountButton').onclick=openSettings;
    $('moreBtn').onclick=openNoteActions;$('insertMath').onclick=insertMath;
    $('favoriteBtn').onclick=()=>{const n=activeNote();if(!n)return;n.favorite=!n.favorite;renderSidebar();renderMeta();saveSoon();toast(n.favorite?'Added to favorites':'Removed from favorites');};
    $('viewSwitch').addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(btn)setView(btn.dataset.view);});
    $('noteTitle').addEventListener('change',updateTitle);$('noteTitle').addEventListener('blur',updateTitle);
    $('noteTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();updateTitle();state.editor?.focus();}});
    $('sidebar').addEventListener('click',e=>{const note=e.target.closest('[data-note-id]');if(note){chooseNote(note.dataset.noteId);return;}const folder=e.target.closest('[data-folder]');if(folder)selectFolder(folder.dataset.folder);});
    $('rightContent').addEventListener('click',e=>{const note=e.target.closest('[data-note-id]');if(note)return chooseNote(note.dataset.noteId);const wiki=e.target.closest('[data-wiki-title]');if(wiki)return openWiki(wiki.dataset.wikiTitle);const target=e.target.closest('[data-heading]');if(target){setView(state.view==='editor'?'split':state.view);setTimeout(()=>{$('previewContent').querySelectorAll('h1,h2,h3,h4')[Number(target.dataset.heading)]?.scrollIntoView({block:'start',behavior:'smooth'});},50);}});
    $('previewContent').addEventListener('click',e=>{const link=e.target.closest('a[data-wiki-title]');if(link){e.preventDefault();openWiki(link.dataset.wikiTitle);}});
    $('modalOverlay').addEventListener('click',e=>{if(e.target===$('modalOverlay')&&state.currentModal!=='conflict')closeModal();});
    $('modalContent').addEventListener('click',e=>{
      const c=e.target.closest('[data-action="close"]');if(c)return closeModal();
      const palette=e.target.closest('[data-palette-index]');if(palette)return runPaletteItem(Number(palette.dataset.paletteIndex));
      const action=e.target.closest('[data-note-action]');if(action){const name=action.dataset.noteAction;closeModal();if(name==='download')exportCurrent();if(name==='duplicate')duplicateNote();if(name==='move')moveNote();if(name==='delete')deleteNote();}
      const setting=e.target.closest('[data-setting]');if(setting){const s=setting.dataset.setting;if(s==='theme')toggleTheme();else{state.settings[s]=!state.settings[s];renderNote();saveSoon();}setting.classList.toggle('on');}
      const graph=e.target.closest('[data-graph-id]');if(graph)chooseNote(graph.dataset.graphId);
    });
    $('importInput').addEventListener('change',async e=>{await importFiles([...e.target.files]);e.target.value='';});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&state.currentModal){if(state.currentModal!=='conflict')closeModal();return;}
      if(state.currentModal)return;
      const cmd=e.ctrlKey||e.metaKey;
      if(cmd&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette('commands');}
      if(cmd&&e.key.toLowerCase()==='p'){e.preventDefault();openPalette('notes');}
      if(cmd&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();newNote();}
      if(cmd&&e.key==='\\'){e.preventDefault();toggleSidebar();}
      if(cmd&&e.key.toLowerCase()==='b'){e.preventDefault();toggleRight();}
      if(cmd&&e.key.toLowerCase()==='s'){e.preventDefault();saveNow();}
    });
    window.addEventListener('beforeunload',()=>{if(state.ready&&state.dirty)stashUnsynced();});
    window.addEventListener('online',()=>{if(state.dirty)saveNow();else checkCloud();});
    window.addEventListener('resize',()=>state.editor?.refresh());
  }
  function showGate(mode='login',message=''){
    $('app').classList.add('hidden-app');$('authGate').classList.remove('hidden');
    state.authMode=mode;
    const configured=!!state.client;
    const headings={login:'Welcome back',signup:'Create your account',forgot:'Reset your password',recovery:'Choose a new password'};
    $('authHeading').textContent=headings[mode]||headings.login;
    $('authSubheading').textContent=mode==='signup'?'Your notes, available from every computer.':
      mode==='forgot'?'We will email you a password-reset link.':
      mode==='recovery'?'Enter a new password for your account.':'Log in to your cloud knowledge space.';
    $('authTabs').classList.toggle('hidden',mode==='forgot'||mode==='recovery');
    $('loginTab').classList.toggle('selected',mode==='login');$('signupTab').classList.toggle('selected',mode==='signup');
    $('authEmailWrap').classList.toggle('hidden',mode==='recovery');
    $('authEmail').required=mode!=='recovery';
    $('authPasswordWrap').classList.toggle('hidden',mode==='forgot');
    $('authPassword').required=mode!=='forgot';
    $('authPassword').autocomplete=mode==='signup'||mode==='recovery'?'new-password':'current-password';
    $('authSubmit').textContent={login:'Sign in',signup:'Create account',forgot:'Send reset link',recovery:'Update password'}[mode];
    $('forgotPassword').classList.toggle('hidden',mode!=='login');
    $('backToLogin').classList.toggle('hidden',mode!=='forgot');
    $('authMessage').textContent=message;
    $('authMessage').classList.toggle('error',false);
    if(!configured){
      $('authForm').classList.add('hidden');$('authTabs').classList.add('hidden');
      $('setupNotice').classList.remove('hidden');
    }else{$('authForm').classList.remove('hidden');$('setupNotice').classList.add('hidden');}
  }
  function showAuthMessage(message,isError=false){
    $('authMessage').textContent=message;$('authMessage').classList.toggle('error',isError);
  }
  async function submitAuth(event){
    event.preventDefault();if(state.authBusy||!state.client)return;
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    state.authBusy=true;$('authSubmit').disabled=true;showAuthMessage('');
    try{
      let response;
      if(state.authMode==='signup')response=await state.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
      else if(state.authMode==='login')response=await state.client.auth.signInWithPassword({email,password});
      else if(state.authMode==='forgot')response=await state.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
      else response=await state.client.auth.updateUser({password});
      if(response.error)throw response.error;
      if(state.authMode==='signup'){
        if(response.data?.session){await openUserVault(response.data.session.user);}
        else showAuthMessage('Check your email for a confirmation link, then sign in.');
      }else if(state.authMode==='forgot')showAuthMessage('If an account exists for that address, a reset link has been sent.');
      else if(state.authMode==='recovery'){
        state.recoveryMode=false;showAuthMessage('Password changed. You can return to your notes.');
        if(response.data?.user)await openUserVault(response.data.user);
      }else if(response.data?.user)await openUserVault(response.data.user);
    }catch(error){showAuthMessage(error.message||'Unable to complete request.',true);}
    finally{state.authBusy=false;$('authSubmit').disabled=false;}
  }
  async function openUserVault(user){
    if(!user||state.booting||state.ready&&state.user?.id===user.id)return;
    state.booting=true;state.ready=false;state.user=user;state.dirty=false;state.conflict=false;
    state.changeSerial=0;clearInterval(state.syncTimer);clearTimeout(state.saveTimer);
    showAuthMessage('Loading your cloud notes…');
    try{
      const row=await fetchCloudVault();state.cloudRevision=Number(row?.revision||0);
      let vault=row?.data||null;
      if(!row){
        const previous=await readVault();
        if(previous&&Array.isArray(previous.notes)&&previous.notes.length&&confirm('Import your previous local Axiom notes into this new cloud account?'))vault=previous;
      }
      const recoveryKey=localRecoveryKey();
      let pending=null;try{pending=sessionStorage.getItem(recoveryKey);}catch{}
      if(pending){
        try{
          const recovered=JSON.parse(pending);
          if(Array.isArray(recovered.notes)&&confirm('Recover unsynced edits saved in this tab? A sync conflict may require you to choose which version to keep.')){
            vault=recovered;state.dirty=true;
          }else clearUnsynced();
        }catch{clearUnsynced();}
      }
      loadSnapshot(vault||{});
      if(window.innerWidth<=900)$('app').classList.add('right-hidden');
      if(window.innerWidth<=650){$('app').classList.add('sidebar-hidden');if(state.view==='split')setView('editor');}
      if(!state.bound){bindEvents();state.bound=true;}
      $('accountButton').textContent=(user.email||'M').charAt(0).toUpperCase();
      $('accountButton').title=user.email||'Account';
      $('authGate').classList.add('hidden');$('app').classList.remove('hidden-app');
      state.ready=true;
      if(!row||state.dirty){state.dirty=false;saveSoon();}
      else setSaveStatus('Saved to cloud');
      clearInterval(state.syncTimer);state.syncTimer=setInterval(checkCloud,15000);
      window.MathJax?.startup?.promise?.then(()=>{if(state.ready)renderPreview();}).catch(()=>{});
    }catch(error){
      state.user=null;state.ready=false;
      console.warn('Failed to load cloud vault',error);
      showGate('login',`Unable to load your cloud notes: ${error.message||error}. Check your database setup and connection.`);
      showAuthMessage(`Unable to load your cloud notes: ${error.message||error}`,true);
    }finally{state.booting=false;}
  }
  async function signOut(){
    if(state.dirty){await saveNow();if(state.dirty&&!confirm('Changes have not synced. Download a JSON backup before signing out. Sign out anyway?'))return;}
    clearInterval(state.syncTimer);clearTimeout(state.saveTimer);
    state.ready=false;state.dirty=false;state.conflict=false;state.cloudRevision=0;
    if(state.editor){state.editor.toTextArea?.();state.editor.getWrapperElement().remove();state.editor=null;}
    state.notes=[];state.folders=[];state.activeId=null;
    closeModal();
    try{await state.client.auth.signOut();}catch(error){console.warn(error);}
    state.user=null;showGate('login','Signed out.');
  }
  async function init(){
    $('loginTab').onclick=()=>showGate('login');$('signupTab').onclick=()=>showGate('signup');
    $('forgotPassword').onclick=()=>showGate('forgot');$('backToLogin').onclick=()=>showGate('login');
    $('authForm').onsubmit=submitAuth;
    const config=window.MAXIOM_CONFIG||{};
    const url=String(config.supabaseUrl||'').trim(),key=String(config.supabasePublishableKey||'').trim();
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)||!key||key.startsWith('YOUR_')||!window.supabase?.createClient){
      showGate('login');return;
    }
    state.client=window.supabase.createClient(url.replace(/\/$/,''),key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    state.client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        state.recoveryMode=true;showGate('recovery');return;
      }
      if(event==='SIGNED_OUT'&&!state.booting){state.ready=false;state.user=null;clearInterval(state.syncTimer);showGate('login');}
      if(event==='SIGNED_IN'&&session?.user&&!state.recoveryMode&&!state.booting&&state.user?.id!==session.user.id){
        setTimeout(()=>openUserVault(session.user),0);
      }
    });
    try{
      const {data,error}=await state.client.auth.getSession();if(error)throw error;
      if(data.session?.user&&!state.recoveryMode)await openUserVault(data.session.user);
      else if(!state.recoveryMode)showGate('login');
    }catch(error){showGate('login');showAuthMessage(error.message||'Login service unavailable.',true);}
  }
  init();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();

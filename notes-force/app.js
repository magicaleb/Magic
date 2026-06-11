(() => {
  "use strict";

  const CONFIG_KEY = "notes-force-config-v2";
  const NOTES_KEY = "notes-force-user-notes-v1";
  const HOLD_MS = 720;
  const KEYPAD_COMMIT_MS = 850;

  const DEFAULT_ITEMS = [
    "Rear Window","Spirited Away","Casablanca","The Truman Show","Arrival","Singin' in the Rain","No Country for Old Men","The Grand Budapest Hotel","Moonlight","Jurassic Park",
    "The Apartment","Mad Max: Fury Road","The Social Network","The Godfather","Before Sunrise","Jaws","The Iron Giant","The Thing","Ratatouille","Portrait of a Lady on Fire",
    "The Matrix","Good Will Hunting","Alien","The Princess Bride","There Will Be Blood","The Silence of the Lambs","Whiplash","The Shawshank Redemption","Inside Llewyn Davis","Parasite",
    "The Lord of the Rings","The Prestige","Amelie","The Dark Knight","Eternal Sunshine of the Spotless Mind","The Big Lebowski","Pan's Labyrinth","The Departed","Blade Runner 2049","The Lion King",
    "Fargo","Knives Out","Little Women","The Sixth Sense","Inception","The Shining","The Royal Tenenbaums","Toy Story","The Handmaiden","Get Out",
    "Children of Men","The Green Knight","The Godfather Part II","The Incredibles","The Exorcist","Chinatown","The Lives of Others","O Brother, Where Art Thou?","La La Land","The Good, the Bad and the Ugly",
    "Memento","The Florida Project","12 Angry Men","Princess Mononoke","The French Connection","The Before Trilogy","A Separation","The Terminator","The Favourite","Memories of Murder",
    "Pulp Fiction","The Red Shoes","Network","The Conversation","Drive","Past Lives","City of God","The Graduate","The Banshees of Inisherin","Heat",
    "Anatomy of a Fall","Fantastic Mr. Fox","Thelma & Louise","The Zone of Interest","Cinema Paradiso","All the President's Men","Aftersun","Die Hard","The Worst Person in the World","Stop Making Sense",
    "The Sting","Roma","The Lighthouse","Sunset Boulevard","Everything Everywhere All at Once","The Holdovers","The Maltese Falcon","The Tree of Life","Do the Right Thing","Raiders of the Lost Ark"
  ];

  const DEFAULT_CONFIG = {
    title: "The Essential 100",
    forceItem: "The Prestige",
    items: DEFAULT_ITEMS,
    practice: false,
    wallpaper: ""
  };

  const HOME_APPS = [
    { id:"calendar", label:"Calendar", digit:"1" },
    { id:"photos", label:"Photos", digit:"2" },
    { id:"camera", label:"Camera", digit:"3" },
    { id:"maps", label:"Maps", digit:"4" },
    { id:"weather", label:"Weather", digit:"5" },
    { id:"clock", label:"Clock", digit:"6" },
    { id:"reminders", label:"Reminders", digit:"7" },
    { id:"store", label:"App Store", digit:"8" },
    { id:"settings", label:"Settings", digit:"9" },
    { id:"facetime", label:"FaceTime" },
    { id:"notes", label:"Notes", action:"launch" },
    { id:"files", label:"Files", action:"clear" },
    { id:"mail", label:"Mail" },
    { id:"podcasts", label:"Podcasts" },
    { id:"calculator", label:"Calculator" },
    { id:"shortcuts", label:"Shortcuts" }
  ];

  const DOCK_APPS = [
    { id:"phone", label:"Phone" },
    { id:"safari", label:"Safari" },
    { id:"messages", label:"Messages" },
    { id:"music", label:"Music", digit:"0" }
  ];

  const DECOYS = [
    { id:"weekend", title:"Weekend", date:"Yesterday", body:"Farmers market\nPick up dry cleaning\nCall Mom\nHike if the weather holds" },
    { id:"groceries", title:"Groceries", date:"Monday", body:"Coffee\nLemons\nPasta\nParmesan\nSparkling water\nOlive oil" },
    { id:"books", title:"Books to find", date:"6/2/26", body:"The City & The City\nPiranesi\nThe Left Hand of Darkness\nTomorrow, and Tomorrow, and Tomorrow" },
    { id:"packing", title:"Packing list", date:"5/28/26", body:"Charger\nHeadphones\nSunglasses\nBlue jacket\nNotebook" }
  ];

  const app = document.querySelector("#app");
  let config = loadConfig();
  let userNotes = loadNotes();
  let view = { type:"home" };
  let homeBuffer = "";
  let forceIndex = null;
  let search = "";
  let keypadBuffer = "";
  let keypadTimer = null;
  let keypadArmed = false;

  function defaults() {
    return { title:DEFAULT_CONFIG.title, forceItem:DEFAULT_CONFIG.forceItem, items:[...DEFAULT_ITEMS], practice:false, wallpaper:"" };
  }

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
      if (saved && Array.isArray(saved.items) && saved.items.length) {
        return {
          title: String(saved.title || DEFAULT_CONFIG.title),
          forceItem: String(saved.forceItem || DEFAULT_CONFIG.forceItem),
          items: saved.items.map(String).map(x => x.trim()).filter(Boolean).slice(0,250),
          practice: Boolean(saved.practice),
          wallpaper: typeof saved.wallpaper === "string" ? saved.wallpaper : ""
        };
      }
    } catch (_) {}
    return defaults();
  }

  function loadNotes() {
    try { const value = JSON.parse(localStorage.getItem(NOTES_KEY)); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }

  function saveConfig() { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (_) {} }
  function saveNotes() { try { localStorage.setItem(NOTES_KEY, JSON.stringify(userNotes)); } catch (_) {} }
  function pulse(pattern) { if (typeof navigator.vibrate === "function") navigator.vibrate(pattern); }
  function esc(value) { return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

  function render() {
    disarmKeypad();
    if (view.type === "home") renderHome();
    else if (view.type === "note") renderNote(view.id);
    else renderList(false);
  }

  function renderHome() {
    view = { type:"home" };
    forceIndex = null;
    homeBuffer = "";
    app.innerHTML = `
      <section class="screen home-screen">
        <div class="wallpaper"></div>
        <header class="status">
          <button class="status-time" id="status-time" type="button">${timeText()}</button>
          <div class="status-icons" aria-hidden="true"><span class="signal"><i></i><i></i><i></i><i></i></span><span class="wifi">)))</span><span class="battery"><i></i></span></div>
        </header>
        <div class="app-grid">${HOME_APPS.map(homeApp).join("")}</div>
        <div class="page-dots"><i></i><i></i></div>
        ${config.practice ? '<div class="home-readout" id="home-readout">Ready</div>' : ""}
        <div class="dock">${DOCK_APPS.map(homeApp).join("")}</div>
        <div class="home-indicator"></div>
      </section>`;
    if (config.wallpaper) document.querySelector(".home-screen").style.setProperty("--wallpaper", `url("${config.wallpaper}")`);
    document.querySelectorAll(".home-app").forEach(button => button.addEventListener("click", () => homeTap(button)));
    longPress(document.querySelector("#status-time"), openSetup, 900);
  }

  function timeText() {
    return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date()).replace(/\s?[AP]M/i,"");
  }

  function homeApp(item) {
    const badge = config.practice ? (item.digit || (item.action === "clear" ? "C" : "")) : "";
    return `<button class="home-app" type="button" data-digit="${item.digit || ""}" data-action="${item.action || ""}" aria-label="${esc(item.label)}">
      <span class="app-icon icon-${item.id}"><span class="icon-art ${item.id === "notes" ? "note" : ""}">${appArt(item.id)}</span>${badge ? `<b class="secret-badge">${badge}</b>` : ""}</span>
      <span class="app-label">${esc(item.label)}</span>
    </button>`;
  }

  function appArt(id) {
    const art = {
      calendar:String(new Date().getDate()), photos:"*", camera:"O", maps:"M", weather:"o", clock:"|", reminders:"...", store:"A", settings:"O",
      facetime:"[]", notes:"=", files:"F", mail:"M", podcasts:"P", calculator:"+", shortcuts:"S", phone:"(", safari:">", messages:"...", music:"n"
    };
    return art[id] || "";
  }

  function homeTap(button) {
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"),130);
    const digit = button.dataset.digit;
    const action = button.dataset.action;
    if (digit) {
      homeBuffer = homeBuffer.length >= 3 ? digit : homeBuffer + digit;
      updateHomeReadout(homeBuffer);
      pulse(14);
      return;
    }
    if (action === "clear") {
      homeBuffer = "";
      updateHomeReadout("Cleared");
      pulse([18,25,18]);
      return;
    }
    if (action === "launch") {
      const number = Number.parseInt(homeBuffer,10);
      forceIndex = Number.isInteger(number) && number >= 1 && number <= config.items.length ? number : null;
      homeBuffer = "";
      pulse(forceIndex ? [30,35,30] : 18);
      renderList(true);
    }
  }

  function updateHomeReadout(text) {
    const readout = document.querySelector("#home-readout");
    if (readout) readout.textContent = text || "Ready";
  }

  function allNotes() {
    return [{ id:"force-list", title:config.title, date:"Today", body:`A personal list, in no particular order - ${config.items.length} items`, force:true }, ...userNotes, ...DECOYS];
  }

  function renderList(fromHome) {
    view = { type:"list" };
    const term = search.trim().toLowerCase();
    const notes = allNotes().filter(note => !term || `${note.title} ${note.body}`.toLowerCase().includes(term));
    app.innerHTML = `
      <section class="screen ${fromHome ? "app-launch" : ""}">
        <div class="safe-top"></div>
        <header class="nav"><button class="nav-button leading" id="folders" type="button">&lsaquo; Folders</button><div></div><button class="more" type="button">...</button></header>
        <div class="list-scroll">
          <h1 class="large-title" id="notes-title">Notes</h1>
          <div class="search-wrap"><span class="search-mark">O</span><input class="search" id="search" type="search" placeholder="Search" value="${esc(search)}" aria-label="Search notes"></div>
          <h2 class="section-title">${term ? "Search Results" : "Notes"}</h2>
          ${notes.length ? `<div class="notes-card">${notes.map(noteRow).join("")}</div>` : '<div class="empty">No Notes Found</div>'}
        </div>
        <footer class="toolbar"><button class="tool left" type="button">□</button><div class="count">${allNotes().length} Notes</div><button class="tool right" id="new-note" type="button">+</button></footer>
      </section>`;
    const input = document.querySelector("#search");
    input.addEventListener("input", event => { search = event.target.value; renderList(false); const fresh = document.querySelector("#search"); fresh.focus(); fresh.setSelectionRange(search.length,search.length); });
    document.querySelectorAll(".note-row").forEach(row => row.addEventListener("click", () => { view = {type:"note",id:row.dataset.id}; render(); }));
    document.querySelector("#new-note").addEventListener("click", createNote);
    longPress(document.querySelector("#folders"), renderHome, HOLD_MS);
    longPress(document.querySelector("#notes-title"), openSetup, 900);
  }

  function noteRow(note) {
    return `<button class="note-row" type="button" data-id="${esc(note.id)}"><div class="row-title">${esc(note.title || "New Note")}</div><div class="row-preview"><span class="row-date">${esc(note.date || "Now")}</span><span class="row-body">${esc(note.body.replace(/\n/g," "))}</span></div></button>`;
  }

  function forcedItems() {
    const items = [...config.items];
    if (!forceIndex || forceIndex < 1 || forceIndex > items.length) return items;
    const target = forceIndex - 1;
    const existing = items.findIndex(item => item.toLowerCase() === config.forceItem.toLowerCase());
    if (existing >= 0 && existing !== target) [items[target],items[existing]] = [items[existing],items[target]];
    else items[target] = config.forceItem;
    return items;
  }

  function renderNote(id) {
    const note = allNotes().find(item => item.id === id);
    if (!note) return renderList(false);
    view = { type:"note", id };
    const list = note.force ? `<ol class="numbered" id="force-list">${forcedItems().map(item => `<li>${esc(item)}</li>`).join("")}</ol>` : `<div class="note-copy" id="note-copy" contenteditable="${note.user ? "true" : "false"}">${esc(note.body)}</div>`;
    const keypad = note.force ? `<div class="hidden-keypad ${config.practice ? "practice" : ""}" id="keypad">${["1","2","3","4","5","6","7","8","9","0"].map(key => `<button class="secret-key" type="button" data-key="${key}">${key}</button>`).join("")}</div>` : "";
    app.innerHTML = `
      <section class="screen note-screen"><div class="safe-top"></div>
        <header class="nav"><button class="nav-button leading" id="back" type="button">&lsaquo; Notes</button><div class="nav-title">${esc(note.title || "New Note")}</div><button class="more" type="button">...</button></header>
        <div class="note-scroll" id="note-scroll"><article class="paper"><p class="meta">Today at ${timeText()}</p><h1 class="note-heading" id="note-heading" contenteditable="${note.user ? "true" : "false"}">${esc(note.title)}</h1>${list}</article></div>
        <footer class="toolbar"><button class="tool left" type="button">O</button><button class="tool" type="button">□</button><button class="tool right" id="compose" type="button">+</button></footer>${keypad}
      </section>`;
    document.querySelector("#back").addEventListener("click", () => { persistNote(note); renderList(false); });
    const compose = document.querySelector("#compose");
    if (note.force) { bindKeypad(); longPress(compose, armKeypad,620,createNote); }
    else { compose.addEventListener("click",createNote); bindAutosave(note); }
  }

  function refreshForceList() {
    const list = document.querySelector("#force-list");
    const scroll = document.querySelector("#note-scroll");
    if (!list || !scroll) return;
    const top = scroll.scrollTop;
    list.innerHTML = forcedItems().map(item => `<li>${esc(item)}</li>`).join("");
    scroll.scrollTop = top;
  }

  function createNote() {
    const note = { id:`user-${Date.now()}`, title:"", date:"Now", body:"", user:true };
    userNotes.unshift(note); saveNotes(); view = {type:"note",id:note.id}; render(); setTimeout(() => document.querySelector("#note-heading").focus(),0);
  }

  function persistNote(note) {
    if (!note.user) return;
    const saved = userNotes.find(item => item.id === note.id); if (!saved) return;
    saved.title = document.querySelector("#note-heading").textContent.trim();
    saved.body = document.querySelector("#note-copy").textContent;
    if (!saved.title && !saved.body.trim()) userNotes = userNotes.filter(item => item.id !== note.id);
    saveNotes();
  }

  function bindAutosave(note) {
    const save = () => { const item = userNotes.find(x => x.id === note.id); if (!item) return; item.title = document.querySelector("#note-heading").textContent.trim(); item.body = document.querySelector("#note-copy").textContent; saveNotes(); };
    document.querySelector("#note-heading").addEventListener("input",save);
    document.querySelector("#note-copy").addEventListener("input",save);
  }

  function longPress(target, held, delay=HOLD_MS, tapped=null) {
    let timer = null, didHold = false;
    const start = event => { if (event) event.preventDefault(); didHold=false; clearTimeout(timer); timer=setTimeout(() => { didHold=true; held(); },delay); };
    const end = () => { clearTimeout(timer); if (!didHold && tapped) tapped(); };
    target.addEventListener("pointerdown",start);
    target.addEventListener("pointerup",end);
    target.addEventListener("pointercancel",() => clearTimeout(timer));
    target.addEventListener("pointerleave",() => clearTimeout(timer));
    target.addEventListener("contextmenu",event => event.preventDefault());
  }

  function armKeypad() {
    keypadArmed=true; keypadBuffer=""; const pad=document.querySelector("#keypad"); pad.classList.add("armed"); pulse(35); clearTimeout(keypadTimer); keypadTimer=setTimeout(disarmKeypad,4000);
  }
  function bindKeypad() { document.querySelectorAll(".secret-key").forEach(key => key.addEventListener("pointerdown",event => { event.preventDefault(); if (!keypadArmed) return; keypadBuffer=(keypadBuffer+key.dataset.key).slice(-3); pulse(14); clearTimeout(keypadTimer); keypadTimer=setTimeout(commitKeypad,keypadBuffer.length===3?250:KEYPAD_COMMIT_MS); })); }
  function commitKeypad() { const number=Number.parseInt(keypadBuffer,10); if (Number.isInteger(number)&&number>=1&&number<=config.items.length) { forceIndex=number; refreshForceList(); pulse([30,35,30]); } disarmKeypad(); }
  function disarmKeypad() { keypadArmed=false; keypadBuffer=""; clearTimeout(keypadTimer); document.querySelector("#keypad")?.classList.remove("armed"); }

  function openSetup() {
    const source = view.type;
    const shade = document.createElement("div"); shade.className="shade";
    const map = [...HOME_APPS,...DOCK_APPS].filter(item => item.digit || item.action).map(item => `<div><b>${item.digit || (item.action==="clear"?"Clear":"Open")}</b><span>${esc(item.label)}</span></div>`).join("");
    shade.innerHTML = `<section class="sheet"><div class="handle"></div><header class="sheet-head"><button class="sheet-action" id="cancel">Cancel</button><h2>Performance Setup</h2><button class="sheet-action done" id="done">Done</button></header><div class="setup-scroll">
      <p class="intro">Tap the apps assigned to the named digits, then tap Notes. Files silently clears an unfinished entry. The hidden keypad remains available inside the force note.</p>
      <div class="form-title">Home Screen</div><div class="form-card"><div class="wallpaper-row"><div class="wallpaper-preview" id="wall-preview"></div><div class="wall-actions"><label class="wall-picker">Choose Background Photo<input id="wall-input" type="file" accept="image/*"></label><button class="wall-remove" id="wall-remove" type="button">Use Default Background</button></div></div></div>
      <div class="form-title">Secret App Map</div><div class="form-card map-card">${map}</div>
      <div class="form-title">Force Note</div><div class="form-card"><label class="form-row"><span>Note title</span><input id="setup-title" value="${esc(config.title)}"></label><label class="form-row"><span>Force item</span><input id="setup-force" value="${esc(config.forceItem)}"></label></div>
      <div class="form-title">Rehearsal</div><div class="form-card"><div class="form-row toggle-row"><span>Show secret mappings</span><button class="switch ${config.practice?"on":""}" id="practice" type="button"></button></div></div>
      <div class="form-title">Numbered List - One Item Per Line</div><div class="form-card"><textarea class="editor" id="setup-list" spellcheck="false">${esc(config.items.join("\n"))}</textarea></div>
      <div class="form-title">Reset</div><button class="reset" id="reset" type="button">Restore Default Performance</button>
    </div></section>`;
    app.appendChild(shade);
    let practice=config.practice, wallpaper=config.wallpaper;
    const preview=document.querySelector("#wall-preview"); if (wallpaper) preview.style.backgroundImage=`url("${wallpaper}")`;
    const close=()=>shade.remove(); const rerender=()=>source==="home"?renderHome():renderList(false);
    document.querySelector("#cancel").addEventListener("click",close);
    document.querySelector("#practice").addEventListener("click",event=>{practice=!practice;event.currentTarget.classList.toggle("on",practice);});
    document.querySelector("#wall-input").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{wallpaper=await resizeImage(file);preview.style.backgroundImage=`url("${wallpaper}")`;}catch(_){event.target.value="";}});
    document.querySelector("#wall-remove").addEventListener("click",()=>{wallpaper="";preview.style.backgroundImage="";});
    document.querySelector("#done").addEventListener("click",()=>{const title=document.querySelector("#setup-title").value.trim(),force=document.querySelector("#setup-force").value.trim(),items=document.querySelector("#setup-list").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,250);if(!title||!force||!items.length)return;config={title,forceItem:force,items,practice,wallpaper};forceIndex=null;saveConfig();close();rerender();});
    document.querySelector("#reset").addEventListener("click",()=>{config=defaults();forceIndex=null;saveConfig();close();rerender();});
    shade.addEventListener("pointerdown",event=>{if(event.target===shade)close();});
  }

  function resizeImage(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("image"));image.onload=()=>{const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.8));};image.src=reader.result;};reader.readAsDataURL(file);});
  }

  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
})();

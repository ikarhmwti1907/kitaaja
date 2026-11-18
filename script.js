const TABS=[["album","📷 Galeri"],["song","🎵 Lagu"],["plan","📅 Jadwal"],["wish","🎁 Wishlist"]];
let tab="album",items=[],db=null,assets=null,canEdit=true;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||"")?u:"";
function note(t){const n=$("#note");n.textContent=t;n.hidden=!t}

async function init(){
  renderTabs();render();
  if(typeof claude==="undefined"){note("File storage.js tidak ditemukan. Pastikan storage.js ikut diunggah ke GitHub, satu folder dengan index.html.");return}
  try{
    const c=await claude.use("db");
    if(!c){note("Penyimpanan online belum tersambung. Periksa SUPABASE_URL dan SUPABASE_KEY di storage.js.");return}
    db=c;
    try{const u=await claude.use("user");canEdit=!!(u&&u.canEdit())}catch(e){}
    $("#form").dataset.t="";
    assets=await claude.use("assets");
    const timer=setTimeout(()=>note("Memuat data terlalu lama. Coba muat ulang halaman."),10000);
    db.collection("items").onSnapshot(s=>{clearTimeout(timer);items=s.docs.map(d=>({id:d.id,...d.data()}));render()},
      e=>{clearTimeout(timer);const m=String(e&&e.message||e);note("Data tidak bisa dibaca. "+(/^404/.test(m)?"Tabel belum dibuat: jalankan setup.sql di Supabase.":/^401|^403/.test(m)?"Kunci atau izin salah: periksa SUPABASE_KEY dan jalankan ulang setup.sql.":/Failed to fetch|NetworkError/i.test(m)?"Alamat tidak terjangkau: periksa SUPABASE_URL atau proyek Supabase sedang dijeda.":"Detail: "+m.slice(0,120)))});
  }catch(e){note("Penyimpanan online belum tersambung. Periksa SUPABASE_URL dan SUPABASE_KEY di storage.js.")}
  render();
}
function renderTabs(){
  $("#tabs").innerHTML=TABS.map(([k,l])=>`<button data-k="${k}" class="${k===tab?"on":""}">${l}</button>`).join("");
  $("#tabs").onclick=e=>{const k=e.target.dataset.k;if(k){tab=k;renderTabs();render()}};
}
async function add(data){
  if(!db){note("Hanya pemilik halaman yang bisa menambah data.");return false}
  try{await db.collection("items").add({...data,type:tab,created:Date.now()});note("");return true}
  catch(e){note("Gagal menyimpan. Periksa koneksi internet dan pengaturan Supabase.");return false}
}
async function upload(file){
  if(!assets){note("Upload hanya tersedia untuk pemilik/editor halaman.");return null}
  try{return await assets.upload(file)}
  catch(e){note(e&&e.code==="unsupported_type"?"Jenis file ini belum didukung. Untuk lagu, gunakan tautan.":"Upload gagal (maks 20 MB per file).");return null}
}
async function del(id,assetId){
  const it=items.find(x=>x.id===id);
  const ids=it&&Array.isArray(it.media)?it.media.map(m=>m.id):(assetId?[assetId]:[]);
  try{await db.doc("items/"+id).delete();if(assets)ids.forEach(a=>assets.delete(a).catch(()=>{}))}catch(e){note("Gagal menghapus.")}
}
async function toggle(id,v){try{await db.doc("items/"+id).update({done:v})}catch(e){note("Gagal mengubah.")}}

function renderForm(){
  const f=$("#form");
  if(!canEdit){f.innerHTML="";return}
  if(tab==="album"){
    const t0=new Date(),today=t0.getFullYear()+"-"+String(t0.getMonth()+1).padStart(2,"0")+"-"+String(t0.getDate()).padStart(2,"0");
    f.innerHTML=`<div class="bar"><label style="flex-basis:100%">Judul / kegiatan<input id="a" placeholder="Contoh: Main ke Dago Dreampark"></label><label>Tanggal<input id="b" type="date" value="${today}"></label><label>Tempat<input id="c" placeholder="Contoh: Dago, Bandung"></label><label style="flex-basis:100%">Foto &amp; video (boleh pilih banyak sekaligus)<input id="file" type="file" accept="image/*,video/*" multiple></label><button class="btn" id="go">Simpan album</button></div>`;
    $("#go").onclick=async()=>{
      const t=$("#a").value.trim(),d=$("#b").value,files=[...$("#file").files];
      if(!t||!d||!files.length){note("Isi judul, tanggal, dan pilih minimal 1 foto atau video.");return}
      const b=$("#go");b.disabled=true;const media=[];let ok=true;
      for(let k=0;k<files.length;k++){b.textContent="Mengunggah "+(k+1)+"/"+files.length+"...";const r=await upload(files[k]);if(!r){ok=false;break}media.push({id:r.id,kind:files[k].type.startsWith("video")?"video":"image",name:files[k].name})}
      const saved=ok&&await add({title:t,date:d,place:$("#c").value.trim(),media});
      if(saved){["a","c","file"].forEach(i=>$("#"+i).value="")}
      else if(assets){media.forEach(m=>assets.delete(m.id).catch(()=>{}))}
      b.disabled=false;b.textContent="Simpan album";
    };
  }else if(tab==="song"){
    f.innerHTML=`<div class="bar"><input id="a" placeholder="Judul lagu"><input id="b" placeholder="Artis"><input id="c" placeholder="Tautan (YouTube/Spotify), opsional"><button class="btn" id="go">Tambah lagu</button></div>`;
    $("#go").onclick=async()=>{
      const t=$("#a").value.trim();if(!t){note("Isi judul lagu.");return}
      if(await add({title:t,artist:$("#b").value.trim(),link:safeUrl($("#c").value.trim())})){["a","b","c"].forEach(i=>$("#"+i).value="")}
    };
  }else if(tab==="plan"){
    f.innerHTML=`<div class="bar"><label style="flex-basis:100%">Main apa<input id="a"></label><label>Tanggal (hari otomatis)<input id="b" type="date"></label><label>Jam kumpul<input id="c" type="time"></label><label>Titik kumpul<input id="d" placeholder="Contoh: Lobi Mall Paris Van Java"></label><label>Tujuan / tempat main (opsional)<input id="e" placeholder="Contoh: Dago Dreampark"></label><button class="btn" id="go">Tambah jadwal</button></div>`;
    $("#go").onclick=async()=>{
      const t=$("#a").value.trim(),d=$("#b").value,tm=$("#c").value,mt=$("#d").value.trim();if(!t||!d||!tm||!mt){note("Isi kegiatan, tanggal, jam, dan titik kumpul.");return}
      if(await add({title:t,date:d,time:tm,meet:mt,place:$("#e").value.trim()})){["a","b","c","d","e"].forEach(i=>$("#"+i).value="")}
    };
  }else{
    f.innerHTML=`<div class="bar"><input id="a" placeholder="Barang / keinginan"><input id="b" placeholder="Catatan atau harga (opsional)"><input id="c" placeholder="Tautan (opsional)"><button class="btn" id="go">Tambah wishlist</button></div>`;
    $("#go").onclick=async()=>{
      const t=$("#a").value.trim();if(!t){note("Isi nama barang.");return}
      if(await add({title:t,note:$("#b").value.trim(),link:safeUrl($("#c").value.trim()),done:false})){["a","b","c"].forEach(i=>$("#"+i).value="")}
    };
  }
}
function render(){
  const n=t=>items.filter(i=>i.type===t).length;
  $("#stats").innerHTML=`<span>📷 ${albumList().length} album</span><span>🎵 ${n("song")} lagu</span><span>📅 ${n("plan")} jadwal</span><span>🎁 ${n("wish")} wishlist</span>`;
  if(!$("#form").dataset.t||$("#form").dataset.t!==tab){renderForm();$("#form").dataset.t=tab}
  const L=tab==="album"?albumList():items.filter(i=>i.type===tab);
  const el=$("#list");
  if(!L.length){el.innerHTML='<div class="empty">Belum ada isinya.</div>';return}
  let h="";
  if(tab==="album"){
    h='<div class="grid">'+L.map(a=>{const m=a.media[0];const cover=m.kind==="video"?`<video preload="metadata" muted playsinline src="${esc(m.url)}#t=0.1"></video><span class="play">▶</span>`:`<img loading="lazy" src="${esc(m.url)}" alt="${esc(a.title)}">`;
      return `<div class="card" data-open="${a.id}"><div class="cov">${cover}<span class="dt">📅 ${esc(fmtD(a.date))}</span>${a.media.length>1?`<span class="cnt">${a.media.length} file</span>`:""}</div><div class="cap"><b>${esc(a.title)}</b>${a.place?`<br><small>📍 ${esc(a.place)}</small>`:""}</div><button class="x" data-del="${a.id}" data-a="${esc(a.legacyAsset||"")}" title="Hapus">×</button></div>`}).join("")+"</div>";
  }else if(tab==="song"){
    L.sort((a,b)=>b.created-a.created);
    h=L.map(i=>`<div class="row"><div style="font-size:1.4rem">♪</div><div class="grow"><div class="t">${esc(i.title)}</div><div class="m">${esc(i.artist)}${i.link?` · <a href="${esc(i.link)}" target="_blank" rel="noopener">Putar</a>`:""}</div></div><button class="xx" data-del="${i.id}">✕</button></div>`).join("");
  }else if(tab==="plan"){
    L.sort((a,b)=>(a.date+(a.time||"")).localeCompare(b.date+(b.time||"")));
    h=L.map(i=>{const d=new Date(i.date+"T00:00");const hari=d.toLocaleDateString("id-ID",{weekday:"long"});return `<div class="row"><div class="date"><span class="dow">${hari.slice(0,3)}</span>${d.getDate()}<br>${d.toLocaleDateString("id-ID",{month:"short"})}</div><div class="grow"><div class="t">${esc(i.title)}</div><div class="det"><span>📅 <b>${hari}, ${d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</b></span>${i.time?`<span>🕐 <b>${esc(i.time)}</b></span>`:""}${i.meet?`<span>📍 Kumpul di <b>${esc(i.meet)}</b></span>`:""}${i.place?`<span>🎯 ${esc(i.place)}</span>`:""}</div></div><button class="xx" data-del="${i.id}">✕</button></div>`}).join("");
  }else{
    L.sort((a,b)=>(a.done?1:0)-(b.done?1:0)||b.created-a.created);
    h=L.map(i=>`<div class="row ${i.done?"done":""}"><input type="checkbox" data-chk="${i.id}" ${i.done?"checked":""}><div class="grow"><div class="t">${esc(i.title)}</div><div class="m">${esc(i.note)}${i.link?` ${i.note?"· ":""}<a href="${esc(i.link)}" target="_blank" rel="noopener">Lihat</a>`:""}</div></div><button class="xx" data-del="${i.id}">✕</button></div>`).join("");
  }
  el.innerHTML=h;
}
let pend=null;
function askDel(id,a,title){pend={id,a};$("#mt").textContent=title;$("#modal").hidden=false}
function closeM(){$("#modal").hidden=true;pend=null}
$("#list").addEventListener("click",e=>{
  const b=e.target.closest("[data-del]");
  if(b){const it=albumList().find(x=>x.id===b.dataset.del)||items.find(x=>x.id===b.dataset.del);askDel(b.dataset.del,b.dataset.a,it?it.title:"");return}
  const c=e.target.closest("[data-open]");if(c)openLb(c.dataset.open)});
$("#no").onclick=closeM;
$("#yes").onclick=()=>{if(pend){const p=pend;closeM();del(p.id,p.a)}};
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeM()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeM()});
$("#list").addEventListener("change",e=>{if(e.target.dataset.chk)toggle(e.target.dataset.chk,e.target.checked)});

function fmtD(ds,long){if(!ds)return"";const d=new Date(ds+"T00:00");return long?d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}
function albumList(){
  const out=[];
  items.forEach(i=>{
    if(i.type==="album"&&Array.isArray(i.media)&&i.media.length){out.push({...i,sort:(i.date||"")+String(i.created||0).padStart(15,"0")})}
    else if(i.type==="photo"||i.type==="video"){
      const d=new Date(i.created||Date.now()),ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      out.push({id:i.id,title:i.title,date:ds,place:"",created:i.created,legacyAsset:i.assetId,media:[{id:i.assetId,kind:i.type==="photo"?"image":"video",url:i.url}],sort:ds+String(i.created||0).padStart(15,"0")});
    }
  });
  return out.sort((a,b)=>b.sort.localeCompare(a.sort));
}
(function(){
  const st=document.createElement("style");
  st.textContent=`.card{cursor:pointer}.card .cov{position:relative}.card .dt{position:absolute;left:6px;bottom:6px;background:rgba(10,6,18,.72);color:#fff;border-radius:999px;padding:2px 10px;font-size:.72rem;font-weight:600}.card .cnt{position:absolute;top:6px;left:6px;background:var(--hero);color:#fff;border-radius:999px;padding:2px 10px;font-size:.72rem;font-weight:700}.card .play{position:absolute;inset:0;margin:auto;width:42px;height:42px;line-height:42px;text-align:center;border-radius:50%;background:rgba(10,6,18,.6);color:#fff;font-size:16px}.card .cap small{color:var(--mute)}
#lb{position:fixed;inset:0;z-index:60;background:rgba(6,4,12,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 56px) 12px calc(env(safe-area-inset-bottom,0px) + 12px)}#lb[hidden]{display:none}
#lb .stage{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}#lb .stage img,#lb .stage video{max-width:100%;max-height:100%;border-radius:12px;object-fit:contain}
#lb .info{width:100%;max-width:640px;text-align:center;padding:14px 8px 6px;color:#f4eef8}#lb h3{margin:2px 0 6px;font-size:1.15rem}#lb .mt{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;color:#d5c8e8;font-size:.9rem}#lb .ct{color:#ff8cc3;font-weight:700;font-size:.85rem;min-height:1.2em}
#lb button{border:0;cursor:pointer;color:#fff;background:rgba(255,255,255,.14);border-radius:50%;width:44px;height:44px;font-size:22px;line-height:1}#lb .lbx{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px}#lb .lbn{position:absolute;top:42%}#lb .lbp{left:10px}#lb .lbq{right:10px}#lb.single .lbn{display:none}`;
  document.head.appendChild(st);
  const lb=document.createElement("div");lb.id="lb";lb.hidden=true;
  lb.innerHTML='<button class="lbx" aria-label="Tutup">✕</button><button class="lbn lbp" aria-label="Sebelumnya">‹</button><div class="stage"></div><button class="lbn lbq" aria-label="Berikutnya">›</button><div class="info"><div class="ct"></div><h3></h3><div class="mt"></div></div>';
  document.body.appendChild(lb);
  const stage=lb.querySelector(".stage");let cur=null,idx=0,x0=null;
  function show(){
    const m=cur.media[idx];stage.innerHTML="";let el;
    if(m.kind==="video"){el=document.createElement("video");el.controls=true;el.playsInline=true}else{el=document.createElement("img");el.alt=cur.title}
    el.src=m.url;stage.appendChild(el);
    lb.querySelector(".ct").textContent=cur.media.length>1?(idx+1)+" / "+cur.media.length:"";
    lb.querySelector("h3").textContent=cur.title;
    lb.querySelector(".mt").innerHTML='<span>📅 '+esc(fmtD(cur.date,true))+'</span>'+(cur.place?'<span>📍 '+esc(cur.place)+'</span>':"");
    lb.classList.toggle("single",cur.media.length<2);
  }
  window.openLb=id=>{cur=albumList().find(a=>a.id===id);if(!cur)return;idx=0;show();lb.hidden=false;document.body.style.overflow="hidden"};
  function closeLb(){lb.hidden=true;stage.innerHTML="";document.body.style.overflow="";cur=null}
  function go(d){if(!cur)return;idx=(idx+d+cur.media.length)%cur.media.length;show()}
  lb.querySelector(".lbx").onclick=closeLb;
  lb.querySelector(".lbp").onclick=()=>go(-1);
  lb.querySelector(".lbq").onclick=()=>go(1);
  lb.addEventListener("click",e=>{if(e.target===lb||e.target===stage)closeLb()});
  lb.addEventListener("touchstart",e=>{x0=e.target.tagName==="VIDEO"?null:e.touches[0].clientX},{passive:true});
  lb.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)go(dx<0?1:-1)});
  document.addEventListener("keydown",e=>{if(lb.hidden)return;if(e.key==="Escape")closeLb();else if(e.key==="ArrowRight")go(1);else if(e.key==="ArrowLeft")go(-1)});
})();
init();

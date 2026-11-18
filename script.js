const TABS=[["photo","📷 Foto"],["video","🎬 Video"],["song","🎵 Lagu"],["plan","📅 Jadwal"],["wish","🎁 Wishlist"]];
let tab="photo",items=[],db=null,assets=null,canEdit=true;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||"")?u:"";
function note(t){const n=$("#note");n.textContent=t;n.hidden=!t}

async function init(){
  renderTabs();render();
  if(typeof claude==="undefined"){note("File storage.js tidak ditemukan. Pastikan storage.js ikut diunggah ke GitHub, satu folder dengan index.html.");return}
  try{
    const c=await claude.use("db");
    if(!c){note("Penyimpanan browser tidak bisa dipakai. Coba keluar dari mode penyamaran.");return}
    db=c;
    try{const u=await claude.use("user");canEdit=!!(u&&u.canEdit())}catch(e){}
    $("#form").dataset.t="";
    assets=await claude.use("assets");
    const timer=setTimeout(()=>note("Memuat data terlalu lama. Coba muat ulang halaman."),10000);
    db.collection("items").onSnapshot(s=>{clearTimeout(timer);items=s.docs.map(d=>({id:d.id,...d.data()}));render()},
      e=>{clearTimeout(timer);note("Data tidak bisa dibaca.")});
  }catch(e){note("Penyimpanan browser tidak tersedia. Coba keluar dari mode penyamaran.")}
  render();
}
function renderTabs(){
  $("#tabs").innerHTML=TABS.map(([k,l])=>`<button data-k="${k}" class="${k===tab?"on":""}">${l}</button>`).join("");
  $("#tabs").onclick=e=>{const k=e.target.dataset.k;if(k){tab=k;renderTabs();render()}};
}
async function add(data){
  if(!db){note("Hanya pemilik halaman yang bisa menambah data.");return false}
  try{await db.collection("items").add({...data,type:tab,created:Date.now()});note("");return true}
  catch(e){note("Gagal menyimpan. Coba keluar dari mode penyamaran, atau ruang penyimpanan browser mungkin penuh.");return false}
}
async function upload(file){
  if(!assets){note("Upload hanya tersedia untuk pemilik/editor halaman.");return null}
  try{return await assets.upload(file)}
  catch(e){note(e&&e.code==="unsupported_type"?"Jenis file ini belum didukung. Untuk lagu, gunakan tautan.":"Upload gagal (maks 20 MB per file).");return null}
}
async function del(id,assetId){
  try{await db.doc("items/"+id).delete();if(assetId&&assets)assets.delete(assetId).catch(()=>{})}catch(e){note("Gagal menghapus.")}
}
async function toggle(id,v){try{await db.doc("items/"+id).update({done:v})}catch(e){note("Gagal mengubah.")}}

function renderForm(){
  const f=$("#form");
  if(!canEdit){f.innerHTML="";return}
  if(tab==="photo"||tab==="video"){
    const acc=tab==="photo"?"image/*":"video/*";
    f.innerHTML=`<div class="bar"><input id="cap" placeholder="Keterangan (opsional)"><input id="file" type="file" accept="${acc}" multiple><button class="btn" id="go">Unggah ${tab==="photo"?"foto":"video"}</button></div>`;
    $("#go").onclick=async()=>{
      const files=[...$("#file").files];if(!files.length){note("Pilih file dulu.");return}
      const b=$("#go");b.disabled=true;b.textContent="Mengunggah...";
      for(const fl of files){const r=await upload(fl);if(!r)break;await add({title:$("#cap").value.trim()||fl.name,assetId:r.id,url:r.url})}
      b.disabled=false;b.textContent="Unggah";$("#file").value="";$("#cap").value="";
    };
  }else if(tab==="song"){
    f.innerHTML=`<div class="bar"><input id="a" placeholder="Judul lagu"><input id="b" placeholder="Artis"><input id="c" placeholder="Tautan (YouTube/Spotify), opsional"><button class="btn" id="go">Tambah lagu</button></div>`;
    $("#go").onclick=async()=>{
      const t=$("#a").value.trim();if(!t){note("Isi judul lagu.");return}
      if(await add({title:t,artist:$("#b").value.trim(),link:safeUrl($("#c").value.trim())})){["a","b","c"].forEach(i=>$("#"+i).value="")}
    };
  }else if(tab==="plan"){
    f.innerHTML=`<div class="bar"><label style="flex-basis:100%">Main apa / dengan siapa<input id="a" placeholder="Contoh: Main bareng Rina dan Dita"></label><label>Tanggal (hari otomatis)<input id="b" type="date"></label><label>Jam kumpul<input id="c" type="time"></label><label>Titik kumpul<input id="d" placeholder="Contoh: Lobi Mall Paris Van Java"></label><label>Tujuan / tempat main (opsional)<input id="e" placeholder="Contoh: Dago Dreampark"></label><button class="btn" id="go">Tambah jadwal</button></div>`;
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
  $("#stats").innerHTML=`<span>📷 ${n("photo")} foto</span><span>🎬 ${n("video")} video</span><span>🎵 ${n("song")} lagu</span><span>📅 ${n("plan")} jadwal</span><span>🎁 ${n("wish")} wishlist</span>`;
  if(!$("#form").dataset.t||$("#form").dataset.t!==tab){renderForm();$("#form").dataset.t=tab}
  const L=items.filter(i=>i.type===tab);
  const el=$("#list");
  if(!L.length){el.innerHTML='<div class="empty">Belum ada isinya. 🌱</div>';return}
  let h="";
  if(tab==="photo"||tab==="video"){
    L.sort((a,b)=>b.created-a.created);
    h='<div class="grid">'+L.map(i=>`<div class="card">${tab==="photo"?`<img loading="lazy" src="${esc(i.url)}" alt="${esc(i.title)}">`:`<video controls preload="metadata" src="${esc(i.url)}"></video>`}<div class="cap">${esc(i.title)}</div><button class="x" data-del="${i.id}" data-a="${esc(i.assetId)}" title="Hapus">×</button></div>`).join("")+"</div>";
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
$("#list").addEventListener("click",e=>{const b=e.target.closest("[data-del]");if(!b)return;const it=items.find(x=>x.id===b.dataset.del);askDel(b.dataset.del,b.dataset.a,it?it.title:"")});
$("#no").onclick=closeM;
$("#yes").onclick=()=>{if(pend){const p=pend;closeM();del(p.id,p.a)}};
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeM()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeM()});
$("#list").addEventListener("change",e=>{if(e.target.dataset.chk)toggle(e.target.dataset.chk,e.target.checked)});
init();

(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const form=$("search-form"), citySelect=$("municipality"), input=$("address"), status=$("data-status"), results=$("results"), count=$("result-count"), list=$("result-list"), button=form.querySelector("button");
  let areas=[];
  const hira=(v)=>String(v??"").replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  const norm=(v)=>hira(String(v??"").normalize("NFKC")).replace(/[\s　・ー―‐-]/g,"").replace(/[ヶケヵカ]/g,"か").replace(/[曾曽]/g,"曽").replace(/[﨑崎]/g,"崎").replace(/[釆采]/g,"采").toLowerCase();
  const esc=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const row=(r)=>({
    id:r.id,prefecture:String(r.prefecture??"").trim(),municipality:String(r.municipality??"").trim(),municipalityReading:String(r.municipalityReading??"").trim(),town:String(r.town??"").trim(),townReading:String(r.townReading??"").trim(),store:String(r.store??"").trim(),status:String(r.status??"配達可能").trim(),deliveryDay:String(r.deliveryDay??"").trim(),matchType:String(r.matchType??"exact").trim(),note:String(r.note??"").trim(),sourceText:String(r.sourceText??"").trim(),enabled:r.enabled!==false&&String(r.enabled).toLowerCase()!=="false"
  });

  async function load(){
    let source=null,url=window.DELIVERY_AREA_CONFIG?.dataUrl?.trim();
    if(url){try{const res=await fetch(`${url}${url.includes("?")?"&":"?"}v=${Date.now()}`,{cache:"no-store",redirect:"follow"});if(!res.ok)throw Error();const payload=await res.json();source=Array.isArray(payload)?payload:payload.rows}catch(e){console.warn("スプレッドシートから読み込めないため初期データを使用します。")}}
    if(!Array.isArray(source))source=window.DELIVERY_AREA_FALLBACK??[];
    areas=source.map(row).filter(r=>r.enabled&&r.municipality);
    const cities=new Map();areas.forEach(r=>cities.set(`${r.prefecture}|${r.municipality}`,`${r.prefecture} ${r.municipality}`));
    [...cities].sort((a,b)=>a[1].localeCompare(b[1],"ja")).forEach(([value,label])=>{const o=document.createElement("option");o.value=value;o.textContent=label;citySelect.appendChild(o)});
    button.disabled=!areas.length;status.textContent=areas.length?`${areas.length}件の配達エリア情報を読み込みました。`:"配達エリア情報を読み込めませんでした。";status.className=areas.length?"data-status ready":"data-status error";
  }

  function score(r,query,selected){
    const q=norm(query),mk=norm(r.municipality),mr=norm(r.municipalityReading),pk=norm(r.prefecture),tk=norm(r.town),tr=norm(r.townReading),sk=norm(r.sourceText),full=norm(r.prefecture+r.municipality+r.town),short=norm(r.municipality+r.town),read=norm(r.municipalityReading+r.townReading);
    if(selected){const [p,m]=selected.split("|");if(r.prefecture!==p||r.municipality!==m)return -1}
    if(!q)return selected&&r.matchType==="municipality"?60:-1;
    let s=selected?25:0,hasCity=q.includes(mk)||q.includes(mr);if(hasCity)s+=35;if(q.includes(pk))s+=4;
    if(r.matchType==="municipality")return hasCity?s+20:-1;
    if(!tk)return -1;
    if(q===full||q===short)s+=120;
    else if(q.startsWith(full)||q.startsWith(short))s+=110;
    else if(q===tk||q===tr||q===sk)s+=100;
    else if(q.startsWith(tk)||q.startsWith(tr)||q.startsWith(sk))s+=92;
    else if(q.includes(tk)||q.includes(tr)||q.includes(sk))s+=86;
    else if(tk.startsWith(q)||tr.startsWith(q)||sk.startsWith(q))s+=70;
    else if(tk.includes(q)||tr.includes(q)||sk.includes(q)||read.startsWith(q))s+=55;
    else return -1;
    return s+Math.min(tk.length,12);
  }

  function search(query,selected){
    let found=areas.map(r=>({r,s:score(r,query,selected)})).filter(x=>x.s>=0);
    const specific=new Set(found.filter(x=>x.r.matchType!=="municipality").map(x=>`${x.r.prefecture}|${x.r.municipality}`));
    found=found.filter(x=>x.r.matchType!=="municipality"||!specific.has(`${x.r.prefecture}|${x.r.municipality}`));
    const groups=new Map();
    found.forEach(({r,s})=>{const key=[r.prefecture,r.municipality,r.town,r.status].join("|");if(!groups.has(key))groups.set(key,{...r,score:s,stores:new Set(),notes:new Set(),days:new Set()});const g=groups.get(key);if(r.store)g.stores.add(r.store);if(r.note)g.notes.add(r.note.replace(/ハンター店/g,"鈴鹿ハンター店").replace(/生桑店/g,"いくわ店"));if(r.deliveryDay)g.days.add(r.deliveryDay);g.score=Math.max(g.score,s)});
    return [...groups.values()].sort((a,b)=>b.score-a.score||a.municipality.localeCompare(b.municipality,"ja")||a.town.localeCompare(b.town,"ja")).slice(0,30);
  }

  function render(items){
    results.hidden=false;list.innerHTML="";count.textContent=items.length?`${items.length}件`:"該当なし";
    if(!items.length){list.innerHTML='<div class="empty"><strong>配達店舗を確認できませんでした</strong><p>市町村名と町名をご確認ください。町名だけでも検索できます。</p></div>';return}
    items.forEach(x=>{
      const confirm=x.status==="要確認",outside=x.status==="エリア外",stores=[...x.stores],notes=[...x.notes],days=[...x.days];
      const storeText=outside?"配達エリア外":confirm?(stores.length>1?stores.join(" または "):stores[0]||"担当店舗の確認が必要です"):stores.join("／")||"担当店舗未登録";
      const reading=x.townReading||(x.town?"読み仮名要確認":`${x.municipalityReading} ぜんいき`),article=document.createElement("article");article.className=`card ${outside?"outside":confirm?"confirm":"possible"}`;
      article.innerHTML=`<div class="card-inner"><span class="badge">${outside?"配達エリア外":confirm?"店舗確認が必要":"配達可能"}</span><p class="label">${outside?"判定":"配達店舗"}</p><p class="store">${esc(storeText)}</p><p class="address-name">${esc(x.prefecture)} ${esc(x.municipality)} ${esc(x.town||"全域")}<span class="reading">（${esc(reading)}）</span></p>${days.length?`<div class="chips">${days.map(d=>`<span class="chip">${esc(d)}配達</span>`).join("")}</div>`:""}${notes.length?`<p class="note">${notes.map(esc).join("／")}</p>`:""}</div>`;
      list.appendChild(article);
    });
  }

  form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim(),selected=citySelect.value;if(!q&&!selected){input.focus();input.setAttribute("aria-invalid","true");render([]);return}input.removeAttribute("aria-invalid");render(search(q,selected))});
  load();
})();

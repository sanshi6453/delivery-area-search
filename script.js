(function(){
  "use strict";
  const $=(id)=>document.getElementById(id);
  const form=$("search-form"), citySelect=$("municipality"), input=$("address"), status=$("data-status"), results=$("results"), count=$("result-count"), list=$("result-list"), button=form.querySelector("button");
  let areas=[],postalMaster=[];
  const hira=(v)=>String(v??"").replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  const norm=(v)=>hira(String(v??"").normalize("NFKC")).replace(/[\s　・ー―‐-]/g,"").replace(/[ヶケヵカ]/g,"か").replace(/[曾曽]/g,"曽").replace(/木曽崎/g,"木曽岬").replace(/[﨑崎]/g,"崎").replace(/[釆采]/g,"采").toLowerCase();
  const esc=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const row=(r)=>({
    id:r.id,prefecture:String(r.prefecture??"").trim(),municipality:String(r.municipality??"").trim(),municipalityReading:String(r.municipalityReading??"").trim(),town:String(r.town??"").trim(),townReading:String(r.townReading??"").trim(),postalCodes:Array.isArray(r.postalCodes)?r.postalCodes.map(v=>String(v).replace(/\D/g,"")).filter(v=>v.length===7):String(r.postalCode??"").split(/[,、／/\s]+/).map(v=>v.replace(/\D/g,"")).filter(v=>v.length===7),store:String(r.store??"").trim(),status:String(r.status??"配達可能").trim(),deliveryDay:String(r.deliveryDay??"").trim(),matchType:String(r.matchType??"exact").trim(),note:String(r.note??"").trim(),sourceText:String(r.sourceText??"").trim(),enabled:r.enabled!==false&&String(r.enabled).toLowerCase()!=="false"
  });
  const applyBusinessRules=r=>{if(r.store==="桑名店"&&["桑名市","いなべ市","員弁郡東員町","桑名郡木曽岬町"].includes(r.municipality))r.deliveryDay="";if(r.store==="桑名店"&&["海部郡蟹江町","海部郡飛島村","弥富市"].includes(r.municipality))r.deliveryDay="水曜日のみ";if(r.store==="桑名店"&&["愛西市","津島市"].includes(r.municipality))r.deliveryDay="金曜日のみ";if(r.municipality==="鈴鹿市"&&r.town==="冨家")r.enabled=false;return r};

  async function load(){
    let source=null,url=window.DELIVERY_AREA_CONFIG?.dataUrl?.trim();
    if(url){try{const res=await fetch(`${url}${url.includes("?")?"&":"?"}v=${Date.now()}`,{cache:"no-store",redirect:"follow"});if(!res.ok)throw Error();const payload=await res.json();source=Array.isArray(payload)?payload:payload.rows}catch(e){console.warn("スプレッドシートから読み込めないため初期データを使用します。")}}
    const extraRules=[row({id:"aichi-amagun",prefecture:"愛知県",municipality:"海部郡",municipalityReading:"あまぐん",town:"",townReading:"",postalCodes:[],store:"桑名店",status:"配達可能",deliveryDay:"水曜日のみ",matchType:"municipality",note:"",enabled:true,sourceText:"愛知県海部郡"})];
    const fallbackRows=[...(window.DELIVERY_AREA_FALLBACK??[]).map(row).map(applyBusinessRules),...extraRules],fallbackById=new Map(fallbackRows.map(r=>[String(r.id),r]));
    if(!Array.isArray(source))source=fallbackRows;
    areas=source.map(row).map(applyBusinessRules).map(r=>{const base=fallbackById.get(String(r.id));if(!r.postalCodes.length&&base?.postalCodes.length)r.postalCodes=base.postalCodes;return r});
    const loadedIds=new Set(areas.map(r=>String(r.id)));fallbackRows.filter(r=>!/^\d+$/.test(String(r.id))).forEach(r=>{if(!loadedIds.has(String(r.id)))areas.push(r)});areas=areas.filter(r=>r.enabled&&r.municipality);
    postalMaster=(window.POSTAL_CODE_MASTER??[]).map(p=>({...p,postalCode:String(p.postalCode??"").replace(/\D/g,"")}));
    const cities=new Map();areas.forEach(r=>cities.set(`${r.prefecture}|${r.municipality}`,{prefecture:r.prefecture,municipality:r.municipality}));
    [...cities].sort((a,b)=>{const rank=x=>x.prefecture==="愛知県"?2:x.municipality==="伊勢市"?1:0,ap=rank(a[1]),bp=rank(b[1]);return ap-bp||b[1].municipality.localeCompare(a[1].municipality,"ja")}).forEach(([value,item])=>{const o=document.createElement("option");o.value=value;o.textContent=item.prefecture==="三重県"?item.municipality:`${item.prefecture} ${item.municipality}`;citySelect.appendChild(o)});
    button.disabled=!areas.length;status.textContent=areas.length?`${areas.length}件の配達エリア情報を読み込みました。`:"配達エリア情報を読み込めませんでした。";status.className=areas.length?"data-status ready":"data-status error";
  }

  function score(r,query,selected){
    const q=norm(query),mk=norm(r.municipality),mr=norm(r.municipalityReading),pk=norm(r.prefecture),tk=norm(r.town),tr=norm(r.townReading),sk=norm(r.sourceText),full=norm(r.prefecture+r.municipality+r.town),short=norm(r.municipality+r.town),read=norm(r.municipalityReading+r.townReading);
    if(selected){const [p,m]=selected.split("|");if(r.prefecture!==p||r.municipality!==m)return -1}
    if(!q)return selected&&r.matchType==="municipality"?60:-1;
    const district=r.municipality.match(/^(.+?郡)/)?.[1]??"",shortMunicipality=r.municipality.replace(/^.*郡/,"");
    let s=selected?25:0,hasCity=q.includes(mk)||q.includes(mr)||(shortMunicipality&&q.includes(norm(shortMunicipality)))||(district&&q.includes(norm(district)));if(hasCity)s+=35;if(q.includes(pk))s+=4;
    if(r.matchType==="municipality")return selected||hasCity?s+20:-1;
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
    const postal=String(query??"").replace(/\D/g,"");
    if(postal.length===7)return searchPostal(postal,selected);
    const place=identifyPlace(query,selected);
    let found=areas.map(r=>({r,s:score(r,query,selected)})).filter(x=>x.s>=0);
    if(place)found=found.filter(x=>x.r.prefecture===place.prefecture&&x.r.municipality===place.municipality);
    const q=norm(query),exactMunicipalities=new Set(found.filter(x=>x.r.matchType==="municipality"&&(q===norm(x.r.municipality)||q===norm(x.r.prefecture+x.r.municipality))).map(x=>`${x.r.prefecture}|${x.r.municipality}`));
    if(exactMunicipalities.size)found=found.filter(x=>exactMunicipalities.has(`${x.r.prefecture}|${x.r.municipality}`));
    const specific=new Set(found.filter(x=>x.r.matchType!=="municipality").map(x=>`${x.r.prefecture}|${x.r.municipality}`));
    found=found.filter(x=>x.r.matchType!=="municipality"||!specific.has(`${x.r.prefecture}|${x.r.municipality}`));
    const groups=new Map();
    found.forEach(({r,s})=>{const key=[r.prefecture,r.municipality,r.town,r.status].join("|");if(!groups.has(key))groups.set(key,{...r,score:s,stores:new Set(),notes:new Set(),days:new Set(),postalCodes:new Set()});const g=groups.get(key);if(r.store)g.stores.add(r.store);if(r.note)g.notes.add(r.note.replace(/ハンター店/g,"鈴鹿ハンター店").replace(/生桑店/g,"いくわ店"));if(r.deliveryDay)g.days.add(r.deliveryDay);r.postalCodes.forEach(p=>g.postalCodes.add(p));g.score=Math.max(g.score,s)});
    return [...groups.values()].map(g=>{if(place&&g.prefecture===place.prefecture&&g.municipality===place.municipality){g.town=place.town;g.townReading=hira(place.townReading);g.postalCodes=new Set(postalMaster.filter(p=>p.prefecture===place.prefecture&&p.municipality===place.municipality&&p.town===place.town).map(p=>p.postalCode))}return g}).sort((a,b)=>b.score-a.score||a.municipality.localeCompare(b.municipality,"ja")||a.town.localeCompare(b.town,"ja")).slice(0,30);
  }

  function identifyPlace(query,selected){
    const q=norm(query);if(!q)return null;
    const candidates=postalMaster.filter(p=>!selected||`${p.prefecture}|${p.municipality}`===selected).filter(p=>q.includes(norm(p.municipality+p.town))||q.includes(norm(p.municipality.replace(/^.*郡/,"")+p.town))||(selected&&q.includes(norm(p.town))));
    return candidates.sort((a,b)=>norm(b.town).length-norm(a.town).length)[0]??null;
  }

  function searchPostal(postal,selected){
    const places=postalMaster.filter(p=>p.postalCode===postal);
    const candidates=areas.filter(r=>r.postalCodes.includes(postal)).filter(r=>!selected||`${r.prefecture}|${r.municipality}`===selected);
    if(!candidates.length)return [];
    const specific=candidates.filter(r=>r.matchType!=="municipality"),chosen=specific.length?specific:candidates,groups=new Map();
    chosen.forEach(r=>{const place=places.find(p=>p.prefecture===r.prefecture&&p.municipality===r.municipality),town=place?.town||r.town||"全域",townReading=hira(place?.townReading||r.townReading),key=[r.prefecture,r.municipality,town,r.status].join("|");if(!groups.has(key))groups.set(key,{...r,town,townReading,score:200,stores:new Set(),notes:new Set(),days:new Set(),postalCodes:new Set([postal])});const g=groups.get(key);if(r.store)g.stores.add(r.store);if(r.note)g.notes.add(r.note.replace(/ハンター店/g,"鈴鹿ハンター店").replace(/生桑店/g,"いくわ店"));if(r.deliveryDay)g.days.add(r.deliveryDay)});
    return [...groups.values()].slice(0,30);
  }

  const formatPostal=v=>`〒${v.slice(0,3)}-${v.slice(3)}`;
  const formatNote=v=>{const lines=String(v).split("\n").map(esc);return String(v).startsWith("愛知県津島市は")?`<strong>${lines.slice(0,2).join("<br>")}</strong>${lines[2]?`<br>${lines.slice(2).join("<br>")}`:""}`:lines.join("<br>")};

  function render(items){
    results.hidden=false;list.innerHTML="";count.textContent=items.length?`${items.length}件`:"該当なし";
    if(!items.length){list.innerHTML='<div class="empty"><strong>配達店舗を確認できませんでした</strong><p>市町村名と町名をご確認ください。町名だけでも検索できます。</p></div>';return}
    items.forEach(x=>{
      const confirm=x.status==="要確認",outside=x.status==="エリア外",stores=[...x.stores],notes=[...x.notes],days=[...x.days];
      const storeText=outside?"配達エリア外":confirm?(stores.length>1?stores.join(" または "):stores[0]||"担当店舗の確認が必要です"):stores.join("／")||"担当店舗未登録";
      const reading=x.townReading||(x.town?"読み仮名要確認":`${x.municipalityReading} ぜんいき`),article=document.createElement("article");article.className=`card ${outside?"outside":confirm?"confirm":days.length?"limited":"possible"}`;
      const codes=[...(x.postalCodes??[])],postalText=codes.length&&codes.length<=6?codes.map(formatPostal).join("／"):codes.length?"町名または郵便番号で絞り込むと表示されます":"郵便番号未登録";
      article.innerHTML=`<div class="card-inner"><span class="badge">${outside?"配達エリア外":confirm?"店舗確認が必要":"配達可能"}</span><p class="label">${outside?"判定":"配達店舗"}</p><p class="store">${esc(storeText)}</p><p class="address-name">${esc(x.prefecture)} ${esc(x.municipality)} ${esc(x.town||"全域")}<span class="reading">（${esc(reading)}）</span></p><p class="postal-code"><span>郵便番号</span>${esc(postalText)}</p>${days.length?`<div class="chips">${days.map(d=>`<span class="chip">${esc(d)}配達</span>`).join("")}</div>`:""}${notes.length?`<p class="note">${notes.map(formatNote).join("／")}</p>`:""}</div>`;
      list.appendChild(article);
    });
  }

  function renderCityPrompt(city){
    results.hidden=false;count.textContent="1件";list.innerHTML=`<article class="card possible info-card"><div class="card-inner"><span class="badge">配達可能</span><p class="label">検索のご案内</p><p class="store">${esc(city)}全域</p><p class="info-message">配達エリア内ですが、デポが複数あるため<br><strong>町名まで入れて再検索してください。</strong></p></div></article>`;
  }

  function renderTsuPrompt(){
    const tsu=["産品","片田町","片田久保町","片田薬王寺町","雲出鋼管町","雲出伊倉津町","雲出長常町","雲出本郷町","雲出島貫","高茶屋小森上野町","高茶屋小森町","城山","高茶屋"],ano=["粟加","安部","河内"];
    results.hidden=false;count.textContent="1件";list.innerHTML=`<article class="card outside info-card area-guide"><div class="card-inner"><span class="badge">一部配達エリア外</span><p class="label">配達エリアのご案内</p><p class="store">津市</p><p class="info-lead">次の市町村はエリア外です。</p><div class="area-block"><b>津市</b><p>${tsu.map(esc).join("・")}</p></div><div class="area-block"><b>安濃町</b><p>${ano.map(esc).join("・")}</p></div><p class="retry">町名まで入れて再検索してください。</p></div></article>`;
  }

  function renderAisaiPrompt(){
    const towns=["佐屋町","須衣町","内佐屋町","柚木町","北一色町","日置町","稲葉町","甘村井町","落合町","西保町","東保町","西條町","東條町","本部田町","大井町","大野町","鰯江町","善太新田町","早尾町","葛木町","戸倉町","新右エ門新田町","下一色町","四会町","宮地町","石田町","後江町","省ヶ森町","山路町","森川町","小茂井町","三和町","立田町","福原新田町"];
    results.hidden=false;count.textContent="1件";list.innerHTML=`<article class="card limited info-card area-guide"><div class="card-inner"><span class="badge">配達可能</span><p class="label">配達エリアのご案内</p><p class="store">愛知県 愛西市</p><div class="chips"><span class="chip">金曜日のみ配達</span></div><p class="info-lead">以下の町名は配達可能です。</p><div class="area-block"><p>${towns.map(esc).join("・")}</p></div><p class="retry limited-retry">町名まで入れて再検索してください。</p></div></article>`;
  }

  function renderIsePrompt(){
    results.hidden=false;count.textContent="1件";list.innerHTML=`<article class="card ise info-card area-guide"><div class="card-inner"><span class="badge">配達可能</span><p class="label">配達店舗</p><p class="store">ベリー小俣店</p><p class="info-lead ise-summary">二見町を除く伊勢市全域、明和町及び玉城町の一部<br>勢田・宇治浦田・中村町</p><p class="retry ise-retry">町名を入れて再検索してください。</p><details class="area-map-details"><summary>配達エリア地図を表示</summary><img class="area-map" src="ise-delivery-area.gif" alt="ベリー宅配サービス配達エリア地図"></details></div></article>`;
  }

  form.addEventListener("submit",e=>{e.preventDefault();const q=input.value.trim(),selected=citySelect.value,city=selected.split("|")[1]??"",nq=norm(q);if((!q&&city==="津市")||(!selected&&(nq===norm("津市")||nq===norm("三重県津市")))){input.removeAttribute("aria-invalid");renderTsuPrompt();return}if((!q&&city==="愛西市")||(!selected&&(nq===norm("愛西市")||nq===norm("愛知県愛西市")))){input.removeAttribute("aria-invalid");renderAisaiPrompt();return}if((!q&&city==="伊勢市")||(!selected&&(nq===norm("伊勢市")||nq===norm("三重県伊勢市")))){input.removeAttribute("aria-invalid");renderIsePrompt();return}if(!q&&["四日市市","鈴鹿市","いなべ市"].includes(city)){input.removeAttribute("aria-invalid");renderCityPrompt(city);return}if(!q&&!selected){input.focus();input.setAttribute("aria-invalid","true");render([]);return}input.removeAttribute("aria-invalid");render(search(q,selected))});
  load();
})();

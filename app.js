const URL="https://xchtpazgbruatvefkaqy.supabase.co";
const KEY="sb_publishable_KzxnoF7Lm-JISN1C7CBDog_I0nZNVia";
const configured=!URL.startsWith("INSERISCI_")&&!KEY.startsWith("INSERISCI_");
const db=configured && window.supabase ? window.supabase.createClient(URL,KEY) : null;
const CATS=[
  "Casa",
  "Alimentari",
  "Trasporti",
  "Auto",
  "Shopping",
  "Svago",
  "Salute",
  "Abbonamenti",
  "Bollette",
  "Istruzione",
  "Altro"
];
let user;
let tx=[];
let goals=[];
let budgets={};
let profile={
  monthly_income:0,
  saving_goal:0,
  strategy:"balanced",
  name:"Utente"
};
let charts={};
let authMode="login";
const $=id=>document.getElementById(id);
const eur=n=>new Intl.NumberFormat("it-IT",{
  style:"currency",
  currency:"EUR"
}).format(Number(n||0));
const month=()=>new Date().toISOString().slice(0,7);
const esc=s=>String(s).replace(
  /[&<>"']/g,
  m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m])
);
function toast(s){
  $("toast").textContent=s;
  $("toast").classList.add("show");
  setTimeout(
    ()=>$("toast").classList.remove("show"),
    2200
  );
}
function monthTx(){
  return tx.filter(
    x=>x.date?.slice(0,7)===month()
  );
}
function totals(){
  let a=monthTx();
  let i=a
    .filter(x=>x.type==="income")
    .reduce((s,x)=>s+ +x.amount,0);
  let e=a
    .filter(x=>x.type==="expense")
    .reduce((s,x)=>s+ +x.amount,0);
  return {
    i,
    e,
    b:i-e,
    r:i?((i-e)/i)*100:0
  };
}
/* =========================
   LOGIN / REGISTRAZIONE
========================= */
document.querySelectorAll(".auth-tab").forEach(b=>{
  b.onclick=()=>{
    authMode=b.dataset.mode;
    document.querySelectorAll(".auth-tab")
      .forEach(x=>x.classList.toggle(
        "active",
        x===b
      ));
    $("authSubmit").textContent=
      authMode==="login"
      ?"Accedi"
      :"Crea account";
  };
});
$("authForm").onsubmit=async e=>{
  e.preventDefault();
  if(!db){
    $("authMsg").textContent=
      "Configura Supabase in app.js.";
    return;
  }
  let r=
    authMode==="login"
    ?
    await db.auth.signInWithPassword({
      email:$("email").value,
      password:$("password").value
    })
    :
    await db.auth.signUp({
      email:$("email").value,
      password:$("password").value
    });
  if(r.error){
    $("authMsg").textContent=r.error.message;
    return;
  }
  if(
    authMode==="signup" &&
    !r.data.session
  ){
    $("authMsg").textContent=
      "Controlla l'email per confermare l'account.";
  }else{
    user=r.data.user;
    await start();
  }
};
/* =========================
   AVVIO
========================= */
async function start(){
  $("authView").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("userEmail").textContent=user.email;
  $("avatar").textContent=
    (user.email||"U")[0].toUpperCase();
  await load();
  showPage("home");
}
/* =========================
   CARICAMENTO DATI
========================= */
async function load(){
  let [
    a,
    b,
    c,
    d
  ]=await Promise.all([
    db
      .from("transactions")
      .select("*")
      .order("date",{ascending:false}),
    db
      .from("profiles")
      .select("*")
      .eq("id",user.id)
      .maybeSingle(),
    db
      .from("goals")
      .select("*")
      .eq("user_id",user.id)
      .order("created_at",{ascending:false}),
    db
      .from("budgets")
      .select("*")
      .eq("user_id",user.id)
  ]);
  tx=a.data||[];
  profile=b.data||profile;
  goals=c.data||[];
  (d.data||[]).forEach(x=>{
    budgets[x.category]=+x.limit_amount;
  });
  applyProfile();
  renderAll();
}
/* =========================
   PROFILO
========================= */
function applyProfile(){
  $("profileName").value=
    profile.name||"";
  $("incomeProfile").value=
    profile.monthly_income||0;
  $("goalProfile").value=
    profile.saving_goal||0;
  $("strategy").value=
    profile.strategy||"balanced";
}
/* =========================
   RENDER GENERALE
========================= */
function renderAll(){
  stats();
  chartsRender();
  recent();
  renderTransactions();
  renderBudgetPreview();
  renderGoals();
  renderInsights();
  renderBudgetEditor();
  alertCheck();
}
/* =========================
   STATISTICHE
========================= */
function stats(){
  let x=totals();
  $("sBalance").textContent=
    eur(x.b);
  $("sIncome").textContent=
    eur(x.i);
  $("sExpense").textContent=
    eur(x.e);
  $("sSaving").textContent=
    Math.max(0,x.r).toFixed(0)+"%";
  $("sSavingSub").textContent=
    profile.monthly_income
    ?
    `target ${eur(profile.saving_goal)}`
    :
    "del reddito";
}
/* =========================
   RIGHE MOVIMENTI
========================= */
function row(x){
  return `
    <div class="row">
      <div>
        <div class="r-title">
          ${esc(x.description)}
        </div>
        <div class="r-sub">
          ${esc(x.category)}
          · ${x.date}
          ${
            x.recurring &&
            x.recurring!=="none"
            ?
            " · ↻ ricorrente"
            :
            ""
          }
        </div>
      </div>
      <div>
        <span class="amount ${
          x.type==="income"
          ?"in"
          :"out"
        }">
          ${
            x.type==="income"
            ?"+"
            :"−"
          }
          ${eur(x.amount)}
        </span>
        <button
          class="del"
          onclick="delTx('${x.id}')"
        >
          ×
        </button>
      </div>
    </div>
  `;
}
/* =========================
   MOVIMENTI RECENTI
========================= */
function recent(){
  $("recent").innerHTML=
    tx.slice(0,5)
      .map(row)
      .join("")
      ||
      `<p>Nessun movimento.</p>`;
}
/* =========================
   LISTA MOVIMENTI
========================= */
function renderTransactions(){
  let q=($("search").value||"")
    .toLowerCase();
  let f=$("typeFilter").value;
  let c=$("catFilter").value;
  let cats=[
    ...new Set(
      tx.map(x=>x.category)
    )
  ];
  $("catFilter").innerHTML=
    '<option value="">Tutte le categorie</option>'+
    cats.map(x=>
      `<option ${
        c===x
        ?"selected"
        :""
      }>${esc(x)}</option>`
    ).join("");
  let a=tx.filter(x=>
    (!f||x.type===f) &&
    (!c||x.category===c) &&
    (
      !q ||
      x.description
        .toLowerCase()
        .includes(q) ||
      x.category
        .toLowerCase()
        .includes(q)
    )
  );
  $("allTransactions").innerHTML=
    a.map(row).join("")
    ||
    "<p>Nessun risultato.</p>";
}
$("search").oninput=
  renderTransactions;
$("typeFilter").onchange=
  renderTransactions;
$("catFilter").onchange=
  renderTransactions;
/* =========================
   GRAFICI
========================= */
function chartsRender(){
  let by={};
  tx.forEach(x=>{
    let m=x.date.slice(0,7);
    by[m]??={
      i:0,
      e:0
    };
    by[m][
      x.type==="income"
      ?"i"
      :"e"
    ] += +x.amount;
  });
  let labs=
    Object.keys(by)
      .sort()
      .slice(-6);
  /* Grafico entrate / spese */
  destroy("flow");
  charts.flow=new Chart(
    $("flowChart"),
    {
      type:"line",
      data:{
        labels:labs,
        datasets:[
          {
            label:"Entrate",
            data:labs.map(
              m=>by[m].i
            ),
            tension:.35
          },
          {
            label:"Spese",
            data:labs.map(
              m=>by[m].e
            ),
            tension:.35
          }
        ]
      },
      options:{
        responsive:true,
        plugins:{
          legend:{
            position:"bottom"
          }
        }
      }
    }
  );
  /* Grafico categorie */
  let cats={};
  monthTx()
    .filter(x=>x.type==="expense")
    .forEach(x=>{
      cats[x.category]=
        (cats[x.category]||0)+
        +x.amount;
    });
  destroy("cat");
  charts.cat=new Chart(
    $("catChart"),
    {
      type:"doughnut",
      data:{
        labels:Object.keys(cats),
        datasets:[
          {
            data:Object.values(cats)
          }
        ]
      },
      options:{
        plugins:{
          legend:{
            position:"bottom"
          }
        }
      }
    }
  );
  /* Grafico risparmio */
  let save=
    labs.map(
      m=>by[m].i-by[m].e
    );
  destroy("saving");
  charts.saving=new Chart(
    $("savingChart"),
    {
      type:"bar",
      data:{
        labels:labs,
        datasets:[
          {
            label:"Saldo",
            data:save
          }
        ]
      },
      options:{
        plugins:{
          legend:{
            display:false
          }
        }
      }
    }
  );
}
function destroy(k){
  if(charts[k]){
    charts[k].destroy();
  }
}
/* =========================
   BUDGET
========================= */
function renderBudgetPreview(){
  let cats={};
  monthTx()
    .filter(x=>x.type==="expense")
    .forEach(x=>{
      cats[x.category]=
        (cats[x.category]||0)+
        +x.amount;
    });
  let arr=
    CATS
      .filter(
        c=>budgets[c]||cats[c]
      )
      .slice(0,6);
  $("budgetPreview").innerHTML=
    arr
      .map(c=>
        budgetLine(
          c,
          cats[c]||0,
          budgets[c]||0,
          false
        )
      )
      .join("")
      ||
      "<p>Nessun budget impostato.</p>";
}
function budgetLine(
  c,
  spent,
  limit,
  edit
){
  let pct=
    limit
    ?
    Math.min(
      100,
      spent/limit*100
    )
    :
    0;
  return `
    <div class="budget-line">
      <div class="budget-top">
        <span>
          <b>${esc(c)}</b>
          · ${eur(spent)}
        </span>
        ${
          edit
          ?
          `
            <input
              class="budget-input"
              data-cat="${esc(c)}"
              type="number"
              min="0"
              value="${limit||""}"
              placeholder="Limite"
            >
          `
          :
          `
            <span>
              ${
                limit
                ?eur(limit)
                :"nessun limite"
              }
            </span>
          `
        }
      </div>
      ${
        limit
        ?
        `
          <div class="bar">
            <i
              class="${
                spent>limit
                ?"over"
                :""
              }"
              style="width:${pct}%"
            ></i>
          </div>
        `
        :
        ""
      }
    </div>
  `;
}
function renderBudgetEditor(){
  let cats=[...CATS];
  $("budgetEditor").innerHTML=
    cats.map(c=>
      budgetLine(
        c,
        monthTx()
          .filter(
            x=>
              x.type==="expense" &&
              x.category===c
          )
          .reduce(
            (s,x)=>s+ +x.amount,
            0
          ),
        budgets[c]||0,
        true
      )
    ).join("");
}
$("saveBudgets").onclick=async()=>{
  for(
    let el of
    document.querySelectorAll(
      ".budget-input"
    )
  ){
    let c=el.dataset.cat;
    let v=+el.value||0;
    budgets[c]=v;
    await db
      .from("budgets")
      .upsert(
        {
          user_id:user.id,
          category:c,
          limit_amount:v
        },
        {
          onConflict:
            "user_id,category"
        }
      );
  }
  toast("Budget salvati");
  renderAll();
};
/* =========================
   OBIETTIVI
========================= */
function renderGoals(){
  let html=
    goals.map(g=>{
      let p=Math.min(
        100,
        +g.target_amount
        ?
        +g.current_amount/
        g.target_amount*100
        :
        0
      );
      return `
        <div class="goal">
          <div class="goal-top">
            <span class="goal-name">
              ${esc(g.name)}
            </span>
            <span class="goal-pct">
              ${p.toFixed(0)}%
            </span>
          </div>
          <div class="r-sub">
            ${eur(g.current_amount)}
            di
            ${eur(g.target_amount)}
            ${
              g.deadline
              ?
              " · entro "+g.deadline
              :
              ""
            }
          </div>
          <div class="bar">
            <i
              style="width:${p}%"
            ></i>
          </div>
          <div class="goal-actions">
            <button
              class="mini-delete"
              onclick="delGoal('${g.id}')"
            >
              Elimina
            </button>
          </div>
        </div>
      `;
    }).join("");
  $("goals").innerHTML=
    html||
    "<p>Nessun obiettivo. Creane uno per iniziare.</p>";
  $("goalPreview").innerHTML=
    goals
      .slice(0,3)
      .map(g=>{
        let p=Math.min(
          100,
          g.current_amount/
          g.target_amount*100
        );
        return `
          <div class="goal">
            <div class="goal-top">
              <span class="goal-name">
                ${esc(g.name)}
              </span>
              <span class="goal-pct">
                ${p.toFixed(0)}%
              </span>
            </div>
            <div class="bar">
              <i
                style="width:${p}%"
              ></i>
            </div>
          </div>
        `;
      }).join("")
      ||
      "<p>Nessun obiettivo.</p>";
}
$("addGoal").onclick=()=>
  $("goalModal")
    .classList
    .remove("hidden");
$("closeGoal").onclick=()=>
  $("goalModal")
    .classList
    .add("hidden");
$("goalForm").onsubmit=async e=>{
  e.preventDefault();
  let r=await db
    .from("goals")
    .insert({
      user_id:user.id,
      name:$("goalName").value,
      target_amount:+$("goalTarget").value,
      current_amount:+$("goalCurrent").value,
      deadline:
        $("goalDate").value||null
    })
    .select()
    .single();
  if(r.error){
    toast(r.error.message);
    return;
  }
  goals.unshift(r.data);
  $("goalModal")
    .classList
    .add("hidden");
  e.target.reset();
  renderAll();
  toast("Obiettivo creato");
};
async function delGoal(id){
  if(
    !confirm(
      "Eliminare l'obiettivo?"
    )
  ) return;
  await db
    .from("goals")
    .delete()
    .eq("id",id);
  goals=
    goals.filter(
      x=>x.id!==id
    );
  renderAll();
}
window.delGoal=delGoal;
/* =========================
   ANALISI / CONSIGLI
========================= */
function renderInsights(){
  let x=totals();
  let income=
    +profile.monthly_income||x.i;
  let arr=[];
  let cats={};
  monthTx()
    .filter(t=>t.type==="expense")
    .forEach(t=>{
      cats[t.category]=
        (cats[t.category]||0)+
        +t.amount;
    });
  let top=
    Object.entries(cats)
      .sort(
        (a,b)=>b[1]-a[1]
      )[0];
  if(!income){
    arr.push([
      "Inserisci il reddito mensile",
      "Aggiungilo nelle impostazioni per rendere l'analisi più precisa."
    ]);
  }else{
    let r=
      (income-x.e)/
      income*100;
    if(r<0){
      arr.push([
        "⚠ Spese oltre il reddito",
        `Questo mese le uscite superano le entrate di ${eur(Math.abs(x.b))}. Parti dalle categorie non essenziali.`
      ]);
    }else if(r<10){
      arr.push([
        "Margine stretto",
        `Ti rimane circa il ${r.toFixed(0)}% del reddito. Puoi cercare una o due spese ricorrenti da ridurre.`
      ]);
    }else{
      arr.push([
        "Margine positivo",
        `Dopo le spese ti rimane circa il ${r.toFixed(0)}% del reddito.`
      ]);
    }
  }
  if(top){
    arr.push([
      `Categoria più pesante: ${top[0]}`,
      `Hai speso ${eur(top[1])} questo mese. Se vuoi aumentare il risparmio, è il primo punto da esaminare.`
    ]);
  }
  let recurring=
    monthTx()
      .filter(
        t=>
          t.recurring &&
          t.recurring!=="none"
      )
      .reduce(
        (s,t)=>s+ +t.amount,
        0
      );
  if(recurring){
    arr.push([
      "Spese ricorrenti",
      `Hai registrato ${eur(recurring)} di spese ricorrenti questo mese. Controlla periodicamente gli abbonamenti.`
    ]);
  }
  $("insights").innerHTML=
    arr.map(a=>`
      <div class="insight">
        <strong>
          ${a[0]}
        </strong>
        <span>
          ${a[1]}
        </span>
      </div>
    `).join("");
  let expenseCount=
    monthTx()
      .filter(
        x=>x.type==="expense"
      ).length;
  $("metrics").innerHTML=`
    <div class="metric">
      <span>
        Rapporto spese/reddito
      </span>
      <strong>
        ${
          income
          ?
          (x.e/income*100)
            .toFixed(1)
          :
          "—"
        }%
      </strong>
    </div>
    <div class="metric">
      <span>
        Spesa media movimento
      </span>
      <strong>
        ${
          expenseCount
          ?
          eur(x.e/expenseCount)
          :
          "—"
        }
      </strong>
    </div>
    <div class="metric">
      <span>
        Obiettivi attivi
      </span>
      <strong>
        ${goals.length}
      </strong>
    </div>
  `;
}
/* =========================
   AVVISI BUDGET
========================= */
function alertCheck(){
  let over=
    Object.entries(budgets)
      .find(
        ([c,l])=>
          l &&
          monthTx()
            .filter(
              t=>
                t.type==="expense" &&
                t.category===c
            )
            .reduce(
              (s,t)=>s+ +t.amount,
              0
            )>l
      );
  if(over){
    $("alertBox")
      .classList
      .remove("hidden");
    $("alertBox").innerHTML=
      `⚠ Hai superato il budget di <b>${esc(over[0])}</b> questo mese.`;
  }else{
    $("alertBox")
      .classList
      .add("hidden");
  }
}
/* =========================
   NUOVO MOVIMENTO
========================= */
function openTx(){
  $("modal")
    .classList
    .remove("hidden");
  $("txDate").value=
    new Date()
      .toISOString()
      .slice(0,10);
  $("txCat").innerHTML=
    CATS
      .map(
        x=>`<option>${x}</option>`
      )
      .join("");
}
$("addBtn").onclick=openTx;
$("addBtn2").onclick=openTx;
$("closeModal").onclick=()=>
  $("modal")
    .classList
    .add("hidden");
$("txForm").onsubmit=async e=>{
  e.preventDefault();
  let r=await db
    .from("transactions")
    .insert({
      user_id:user.id,
      type:$("txType").value,
      description:
        $("txDesc")
          .value
          .trim(),
      category:$("txCat").value,
      amount:+$("txAmount").value,
      date:$("txDate").value,
      recurring:$("txRecurring").value
    })
    .select()
    .single();
  if(r.error){
    toast(r.error.message);
    return;
  }
  tx.unshift(r.data);
  $("modal")
    .classList
    .add("hidden");
  e.target.reset();
  renderAll();
  toast("Movimento salvato");
};
/* =========================
   ELIMINA MOVIMENTO
========================= */
async function delTx(id){
  if(
    !confirm(
      "Eliminare questo movimento?"
    )
  ) return;
  let r=await db
    .from("transactions")
    .delete()
    .eq("id",id);
  if(!r.error){
    tx=
      tx.filter(
        x=>x.id!==id
      );
    renderAll();
    toast(
      "Movimento eliminato"
    );
  }
}
window.delTx=delTx;
/* =========================
   SALVATAGGIO PROFILO
========================= */
$("profileForm").onsubmit=async e=>{
  e.preventDefault();
  profile={
    ...profile,
    id:user.id,
    name:
      $("profileName").value||
      "Utente",
    monthly_income:
      +$("incomeProfile").value||0,
    saving_goal:
      +$("goalProfile").value||0,
    strategy:
      $("strategy").value
  };
  let r=await db
    .from("profiles")
    .upsert(profile);
  if(r.error){
    toast(r.error.message);
  }else{
    toast(
      "Profilo aggiornato"
    );
    renderAll();
  }
};
/* =========================
   NAVIGAZIONE
========================= */
function showPage(id){
  document
    .querySelectorAll(".page")
    .forEach(x=>
      x.classList.toggle(
        "hidden",
        x.id!==id
      )
    );
  document
    .querySelectorAll(".nav")
    .forEach(x=>
      x.classList.toggle(
        "active",
        x.dataset.page===id
      )
    );
  $("title").textContent={
    home:"Panoramica",
    movimenti:"Movimenti",
    budget:"Budget",
    obiettivi:"Obiettivi",
    analisi:"Analisi",
    impostazioni:"Impostazioni"
  }[id];
  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}
document.addEventListener(
  "click",
  e=>{
    let b=
      e.target.closest(
        "[data-page]"
      );
    if(b)
      showPage(
        b.dataset.page
      );
  }
);
/* =========================
   TEMA SCURO
========================= */
$("themeBtn").onclick=()=>{
  document.body
    .classList
    .toggle("dark");
  localStorage.setItem(
    "bf-dark",
    document.body.classList.contains(
      "dark"
    )
    ?"1"
    :"0"
  );
};
if(
  localStorage.getItem(
    "bf-dark"
  )==="1"
){
  document.body
    .classList
    .add("dark");
}
/* =========================
   LOGOUT
========================= */
function logout(){
  db?.auth.signOut();
  $("app")
    .classList
    .add("hidden");
  $("authView")
    .classList
    .remove("hidden");
}
$("logout").onclick=logout;
$("logout2").onclick=logout;
/* =========================
   DATA
========================= */
$("dateLabel").textContent=
  new Intl.DateTimeFormat(
    "it-IT",
    {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    }
  ).format(new Date());
/* =========================
   CONTROLLO SESSIONE
========================= */
(async()=>{
  if(db){
    let s=
      await db.auth.getSession();
    if(s.data.session){
      user=
        s.data.session.user;
      await start();
    }
  }else{
    $("authMsg").textContent=
      "Configura Supabase in app.js per attivare login e database.";
  }
})();

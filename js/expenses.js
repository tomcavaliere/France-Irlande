// expenses.js
// Expense tracking: add, delete, render summary and list.

var DEP_COLORS={
  'Hébergement':'#1a5e1f','Nourriture':'#e8772e','Transport':'#3498db',
  'Équipement':'#8e44ad','Loisirs':'#e67e22','Autre':'#7f8c8d'
};

function addExpense(){
  var date=document.getElementById('depDate').value;
  var cat=document.getElementById('depCat').value;
  var amount=parseFloat(document.getElementById('depAmount').value);
  var desc=document.getElementById('depDesc').value.trim();
  if(!date||isNaN(amount)||amount<=0){return;}
  var id='d'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  var exp={date:date,cat:cat,amount:amount,desc:desc||cat,ts:Date.now()};
  // Optimistic UI
  expenses[id]=Object.assign({},exp,{_pending:true});
  saveExpensesCache();
  if(activeTab()==='depenses')renderExpenses();
  document.getElementById('depAmount').value='';
  document.getElementById('depDesc').value='';
  tryWrite('set','expenses/'+id,exp);
}

function deleteExpense(id){
  if(!isAdmin)return;
  var exp=expenses[id];
  var label=exp?(exp.desc||exp.cat)+' · '+exp.amount.toFixed(2)+' €':'cette dépense';
  confirmDialog({
    title:'Supprimer la dépense',
    message:'Supprimer '+label+' ? Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
    delete expenses[id];
    saveExpensesCache();
    if(activeTab()==='depenses')renderExpenses();
    tryWrite('remove','expenses/'+id);
  });
}

function renderExpenses(){
  var ids=Object.keys(expenses).sort(function(a,b){
    return (expenses[b].date||'').localeCompare(expenses[a].date||'');
  });
  var total=0,byDate={},byCat={};
  ids.forEach(function(id){
    var e=expenses[id];total+=e.amount;
    if(!byDate[e.date])byDate[e.date]=[];byDate[e.date].push({id:id,e:e});
    byCat[e.cat]=(byCat[e.cat]||0)+e.amount;
  });
  var days=Object.keys(byDate).length||1;
  // Summary
  var catBarHtml=Object.keys(DEP_COLORS).map(function(cat){
    if(!byCat[cat])return '';
    var pct=Math.round((byCat[cat]/total)*100);
    return '<div class="dep-cat-row">'+
      '<div class="dep-cat-label">'+cat+'</div>'+
      '<div class="dep-cat-track"><div class="dep-cat-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="dep-cat-val">'+byCat[cat].toFixed(0)+'€</div></div>';
  }).join('');
  document.getElementById('depSummary').innerHTML=
    '<div class="dep-summary">'+
      '<div style="font-size:13px;font-weight:600;opacity:.85">Résumé</div>'+
      '<div class="dep-summary-grid">'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+total.toFixed(0)+'€</div><div class="dep-sum-l">Total</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+days+'</div><div class="dep-sum-l">Jours</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+(total/days).toFixed(0)+'€</div><div class="dep-sum-l">/ jour</div></div>'+
      '</div>'+
      (catBarHtml?'<div class="dep-cat-bar">'+catBarHtml+'</div>':'')+
    '</div>';
  // List by date
  var listHtml='';
  Object.keys(byDate).sort(function(a,b){return b.localeCompare(a);}).forEach(function(date){
    var d=new Date(date+'T12:00:00');
    var label=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'});
    var dayTotal=byDate[date].reduce(function(s,x){return s+x.e.amount;},0);
    listHtml+='<div class="dep-day-header">'+label+' — '+dayTotal.toFixed(0)+'€</div>';
    byDate[date].forEach(function(item){
      var color=DEP_COLORS[item.e.cat]||'#999';
      listHtml+='<div class="dep-card">'+
        '<div class="dep-cat-dot" style="background:'+color+'"></div>'+
        '<div class="dep-info">'+
          '<div class="dep-info-top">'+
            '<div class="dep-desc">'+escHtml(item.e.desc)+(item.e._pending?' ⏳':'')+'</div>'+
            '<div class="dep-amount">'+item.e.amount.toFixed(2)+'€</div>'+
          '</div>'+
          '<div class="dep-meta">'+item.e.cat+'</div>'+
        '</div>'+
        '<button class="dep-del" onclick="deleteExpense(\''+item.id+'\')">🗑</button>'+
        '</div>';
    });
  });
  document.getElementById('depList').innerHTML=listHtml||
    '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:24px 0">Aucune dépense enregistrée.</div>';
}

function initExpenses(){
  var today=new Date().toISOString().slice(0,10);
  var el=document.getElementById('depDate');if(el)el.value=today;
  if(_unsubExpenses)_unsubExpenses();
  _unsubExpenses=window._fbOnValue(window._fbRef(window._fbDb,'expenses'),function(snap){
    expenses=snap.val()||{};
    saveExpensesCache();
    if(activeTab()==='depenses')renderExpenses();
  });
}

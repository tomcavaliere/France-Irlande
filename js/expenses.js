// expenses.js
// Expense tracking: add, delete, render summary and list.

var DEP_COLORS={
  'Hébergement':'#1a5e1f','Nourriture':'#e8772e','Transport':'#3498db',
  'Équipement':'#8e44ad','Loisirs':'#e67e22','Autre':'#7f8c8d'
};
var CAT_ICONS={
  'Hébergement':'🏕','Nourriture':'🍔','Transport':'🚢',
  'Équipement':'🔧','Loisirs':'🍺','Autre':'📦'
};

function addExpense(){
  var date=document.getElementById('depDate').value;
  var cat=document.getElementById('depCat').value;
  var amount=parseFloat(document.getElementById('depAmount').value);
  var desc=document.getElementById('depDesc').value.trim();
  var v=Utils.validateExpense({amount:amount,cat:cat,date:date,desc:desc||undefined});
  if(!v.ok){showToast(v.error,'warn');return;}
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
  var s=Utils.summarizeExpenses(expenses);
  // Summary
  var catBarHtml=Object.keys(DEP_COLORS).map(function(cat){
    if(!s.byCat[cat])return '';
    var pct=Math.round((s.byCat[cat]/s.total)*100);
    return '<div class="dep-cat-row">'+
      '<div class="dep-cat-label">'+cat+'</div>'+
      '<div class="dep-cat-track"><div class="dep-cat-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="dep-cat-val">'+s.byCat[cat].toFixed(0)+'€</div></div>';
  }).join('');
  document.getElementById('depSummary').innerHTML=
    '<div class="dep-summary">'+
      '<div style="font-size:13px;font-weight:600;opacity:.85">Résumé</div>'+
      '<div class="dep-summary-grid">'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.total.toFixed(0)+'€</div><div class="dep-sum-l">Total</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.days+'</div><div class="dep-sum-l">Jours</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.perDay.toFixed(0)+'€</div><div class="dep-sum-l">/ jour</div></div>'+
      '</div>'+
      (catBarHtml?'<div class="dep-cat-bar">'+catBarHtml+'</div>':'')+
    '</div>';
  // List by date
  var listHtml='';
  Object.keys(s.byDate).sort(function(a,b){return b.localeCompare(a);}).forEach(function(date){
    var d=new Date(date+'T12:00:00');
    var label=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'});
    var dayTotal=s.byDate[date].reduce(function(acc,x){return acc+x.expense.amount;},0);
    listHtml+='<div class="dep-day-header">'+label+' — '+dayTotal.toFixed(0)+'€</div>';
    s.byDate[date].forEach(function(item){
      var color=DEP_COLORS[item.expense.cat]||'#999';
      listHtml+='<div class="dep-card">'+
        '<div class="dep-cat-dot" style="background:'+color+'"></div>'+
        '<div class="dep-info">'+
          '<div class="dep-info-top">'+
            '<div class="dep-desc">'+escHtml(item.expense.desc)+(item.expense._pending?' ⏳':'')+'</div>'+
            '<div class="dep-amount">'+item.expense.amount.toFixed(2)+'€</div>'+
          '</div>'+
          '<div class="dep-meta">'+item.expense.cat+'</div>'+
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
  var dateEl=document.getElementById('depDate');if(dateEl)dateEl.value=today;
  // Générer le select depuis la source de vérité Utils.EXPENSE_CATEGORIES
  var selectEl=document.getElementById('depCat');
  if(selectEl){
    selectEl.innerHTML=Utils.EXPENSE_CATEGORIES.map(function(cat){
      var icon=CAT_ICONS[cat]||'';
      return '<option value="'+cat+'">'+(icon?icon+' ':'')+cat+'</option>';
    }).join('');
  }
  // Appliquer la limite de taille depuis Utils.LIMITS
  var descEl=document.getElementById('depDesc');
  if(descEl)descEl.setAttribute('maxlength',String(Utils.LIMITS.EXPENSE_DESC));
  if(_unsubExpenses)_unsubExpenses();
  _unsubExpenses=window._fbOnValue(window._fbRef(window._fbDb,'expenses'),function(snap){
    expenses=snap.val()||{};
    saveExpensesCache();
    if(activeTab()==='depenses')renderExpenses();
  });
}

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
var DEP_DOT_CLASS={
  'Hébergement':'dep-dot-hebergement',
  'Nourriture':'dep-dot-nourriture',
  'Transport':'dep-dot-transport',
  'Équipement':'dep-dot-equipement',
  'Loisirs':'dep-dot-loisirs',
  'Autre':'dep-dot-autre'
};

function addExpense(){
  var date=document.getElementById('depDate').value;
  var cat=document.getElementById('depCat').value;
  var amount=parseFloat(document.getElementById('depAmount').value);
  var desc=document.getElementById('depDesc').value.trim();
  var paidBy=document.getElementById('depPaidBy').value;
  var v=Utils.validateExpense({amount:amount,cat:cat,date:date,desc:desc||undefined,paidBy:paidBy});
  if(!v.ok){showToast(v.error,'warn');return;}
  var id='d'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
  var exp={date:date,cat:cat,amount:amount,desc:desc||cat,paidBy:paidBy,ts:Date.now()};
  // Optimistic UI
  expenses[id]=Object.assign({},exp,{_pending:true});
  saveExpensesCache();
  Events.emit('state:expenses-changed');
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
    Events.emit('state:expenses-changed');
    tryWrite('remove','expenses/'+id);
  });
}

function renderExpenses(){
  var s=Utils.summarizeExpenses(expenses);
  var tomTotal=s.byPerson['Tom']||0;
  var chloeTotal=s.byPerson['Chloé']||0;
  // Balance message
  var balanceHtml='';
  if(tomTotal>0||chloeTotal>0){
    var diff=Math.round(Math.abs(s.balance));
    var balanceMsg='';
    if(diff<1){
      balanceMsg='⚖️ À l\'équilibre !';
    } else if(s.balance>0){
      balanceMsg='👉 Chloé doit <strong>'+diff+'€</strong> à Tom';
    } else {
      balanceMsg='👉 Tom doit <strong>'+diff+'€</strong> à Chloé';
    }
    balanceHtml='<div class="dep-balance">'+
      '<div class="dep-balance-row">'+
        '<span class="dep-person-tag dep-person-tom">Tom</span>'+
        '<span class="dep-balance-val">'+tomTotal.toFixed(0)+'€</span>'+
      '</div>'+
      '<div class="dep-balance-row">'+
        '<span class="dep-person-tag dep-person-chloe">Chloé</span>'+
        '<span class="dep-balance-val">'+chloeTotal.toFixed(0)+'€</span>'+
      '</div>'+
      '<div class="dep-balance-owe">'+balanceMsg+'</div>'+
    '</div>';
  }
  // Summary
  var catBarHtml=Object.keys(DEP_COLORS).map(function(cat){
    if(!s.byCat[cat])return '';
    var pct=Math.round((s.byCat[cat]/s.total)*100);
    return '<div class="dep-cat-row">'+
      '<div class="dep-cat-label">'+cat+'</div>'+
      '<progress class="dep-cat-track" max="100" value="'+pct+'"></progress>'+
      '<div class="dep-cat-val">'+s.byCat[cat].toFixed(0)+'€</div></div>';
  }).join('');
  document.getElementById('depSummary').innerHTML=
    '<div class="dep-summary">'+
      '<div class="dep-summary-title">Résumé</div>'+
      '<div class="dep-summary-grid">'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.total.toFixed(0)+'€</div><div class="dep-sum-l">Total</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.days+'</div><div class="dep-sum-l">Jours</div></div>'+
        '<div class="dep-sum-item"><div class="dep-sum-v">'+s.perDay.toFixed(0)+'€</div><div class="dep-sum-l">/ jour</div></div>'+
      '</div>'+
      (catBarHtml?'<div class="dep-cat-bar">'+catBarHtml+'</div>':'')+
      balanceHtml+
    '</div>';
  // List by date
  var listHtml='';
  Object.keys(s.byDate).sort(function(a,b){return b.localeCompare(a);}).forEach(function(date){
    var d=new Date(date+'T12:00:00');
    var label=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'});
    var dayTotal=s.byDate[date].reduce(function(acc,x){return acc+x.expense.amount;},0);
    listHtml+='<div class="dep-day-header">'+label+' — '+dayTotal.toFixed(0)+'€</div>';
    s.byDate[date].forEach(function(item){
      var dotClass=DEP_DOT_CLASS[item.expense.cat]||'dep-dot-default';
      var personTag=item.expense.paidBy?
        '<span class="dep-person-tag dep-person-'+(item.expense.paidBy==='Tom'?'tom':'chloe')+'">'+escHtml(item.expense.paidBy)+'</span>':
        '';
      listHtml+='<div class="dep-card">'+
        '<div class="dep-cat-dot '+dotClass+'"></div>'+
        '<div class="dep-info">'+
          '<div class="dep-info-top">'+
            '<div class="dep-desc">'+escHtml(item.expense.desc)+(item.expense._pending?' ⏳':'')+'</div>'+
            '<div class="dep-amount">'+item.expense.amount.toFixed(2)+'€</div>'+
          '</div>'+
          '<div class="dep-meta">'+item.expense.cat+personTag+'</div>'+
        '</div>'+
        '<button class="dep-del" data-action="deleteExpense" data-arg="'+escAttr(item.id)+'">🗑</button>'+
        '</div>';
    });
  });
  document.getElementById('depList').innerHTML=listHtml||
    '<div class="empty-state">Aucune dépense enregistrée.</div>';
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
  var paidByEl=document.getElementById('depPaidBy');
  if(paidByEl){
    paidByEl.innerHTML=Utils.EXPENSE_PERSONS.map(function(p){
      return '<option value="'+p+'">'+p+'</option>';
    }).join('');
  }
  // Appliquer la limite de taille depuis Utils.LIMITS
  var descEl=document.getElementById('depDesc');
  if(descEl)descEl.setAttribute('maxlength',String(Utils.LIMITS.EXPENSE_DESC));
  if(_unsubExpenses)_unsubExpenses();
  _unsubExpenses=window._fbOnValue(window._fbRef(window._fbDb,'expenses'),function(snap){
    expenses=snap.val()||{};
    saveExpensesCache();
    Events.emit('state:expenses-changed');
  });
}

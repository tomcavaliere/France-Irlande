// weather.js
// Weather forecast display using Open-Meteo API.

var WMO_ICONS={
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'🌨️',75:'❄️',
  77:'❄️',
  80:'🌦️',81:'🌧️',82:'⛈️',
  85:'🌨️',86:'🌨️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};
var WMO_DESC={
  0:'Clair',1:'Peu nuageux',2:'Partiellement nuageux',3:'Couvert',
  45:'Brouillard',48:'Brouillard givrant',
  51:'Bruine légère',53:'Bruine',55:'Bruine forte',
  61:'Pluie légère',63:'Pluie',65:'Pluie forte',
  71:'Neige légère',73:'Neige',75:'Neige forte',77:'Grésil',
  80:'Averses légères',81:'Averses',82:'Averses fortes',
  85:'Averses de neige',86:'Averses de neige fortes',
  95:'Orage',96:'Orage avec grêle',99:'Orage fort'
};

function fetchWeather(){
  var box=document.getElementById('weatherBox');
  if(!box)return;
  var pos=getCurrentPos();
  var lat,lon,label;
  if(pos){
    lat=pos.lat;lon=pos.lon;
    label='ta position actuelle';
  } else {
    // Pas de position : météo au départ (Annecy)
    lat=ALL_ROUTE_PTS[0][0];lon=ALL_ROUTE_PTS[0][1];
    label='Annecy (départ)';
  }
  var url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+
    '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max'+
    '&timezone=auto&forecast_days=3';
  box.innerHTML='<div class="weather-card"><div class="weather-title">☁️ Météo — '+label+'</div>'+
    '<div style="font-size:12px;color:var(--text-light)">Chargement...</div></div>';
  Utils.safeFetch(url,{},{retries:2,timeout:10000}).then(function(r){return r.json();}).then(function(d){
    var days=d.daily;
    var html2='<div class="weather-card">'+
      '<div class="weather-title">☁️ Météo — 3 jours</div>'+
      '<div class="weather-stage">'+label+'</div>'+
      '<div class="weather-days">';
    for(var i=0;i<3;i++){
      var date=new Date(days.time[i]+'T12:00:00');
      var lbl=i===0?'Aujourd\'hui':i===1?'Demain':date.toLocaleDateString('fr-FR',{weekday:'short'});
      var code=days.weathercode[i];
      var icon=WMO_ICONS[code]||'🌡️';
      var desc=WMO_DESC[code]||'';
      var tmax=Math.round(days.temperature_2m_max[i]);
      var tmin=Math.round(days.temperature_2m_min[i]);
      var rain=days.precipitation_sum[i];
      var wind=Math.round(days.windspeed_10m_max[i]);
      html2+='<div class="weather-day">'+
        '<div class="weather-day-label">'+lbl+'</div>'+
        '<div class="weather-icon" title="'+desc+'">'+icon+'</div>'+
        '<div class="weather-temps">'+tmax+'° <span>/ '+tmin+'°</span></div>'+
        (rain>0?'<div class="weather-rain">💧 '+rain.toFixed(1)+' mm</div>':'<div class="weather-rain" style="color:#ccc">Pas de pluie</div>')+
        '<div class="weather-wind">💨 '+wind+' km/h</div>'+
        '</div>';
    }
    html2+='</div></div>';
    box.innerHTML=html2;
  }).catch(function(e){
    console.warn('[Weather] fetch failed:',e);
    box.innerHTML='<div class="weather-card" style="text-align:center;color:var(--text-light);font-size:12px">'+
      'Météo indisponible hors-ligne</div>';
  });
}

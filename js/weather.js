// weather.js
// Weather forecast display using Open-Meteo API.

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
    if(!window.WeatherCore) throw new Error('WeatherCore module non chargé');
    var days=window.WeatherCore?window.WeatherCore.buildWeatherDays(d.daily):[];
    if(!days.length){ throw new Error('Réponse météo invalide'); }
    var html2='<div class="weather-card">'+
      '<div class="weather-title">☁️ Météo — 3 jours</div>'+
      '<div class="weather-stage">'+label+'</div>'+
      '<div class="weather-days">';
    for(var i=0;i<3;i++){
      var day=days[i];
      html2+='<div class="weather-day">'+
        '<div class="weather-day-label">'+day.label+'</div>'+
        '<div class="weather-icon" title="'+day.desc+'">'+day.icon+'</div>'+
        '<div class="weather-temps">'+day.tmax+'° <span>/ '+day.tmin+'°</span></div>'+
        (day.hasRain?'<div class="weather-rain">💧 '+day.rain.toFixed(1)+' mm</div>':'<div class="weather-rain" style="color:#ccc">Pas de pluie</div>')+
        '<div class="weather-wind">💨 '+day.wind+' km/h</div>'+
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

// weather-core.js
// Fonctions pures pour transformer la réponse Open-Meteo en modèle d'affichage.

(function(){
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

  function weatherDayLabel(i, isoDate){
    if (i === 0) return 'Aujourd\'hui';
    if (i === 1) return 'Demain';
    return new Date((isoDate || '') + 'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short'});
  }

  function buildWeatherDays(daily){
    if (!daily || typeof daily !== 'object') return [];
    if (!Array.isArray(daily.time) || daily.time.length < 3) return [];
    var out = [];
    for (var i = 0; i < 3; i++){
      var code = Number(daily.weathercode && daily.weathercode[i]);
      var rain = Number(daily.precipitation_sum && daily.precipitation_sum[i]) || 0;
      out.push({
        label: weatherDayLabel(i, daily.time[i]),
        code: code,
        icon: WMO_ICONS[code] || '🌡️',
        desc: WMO_DESC[code] || '',
        tmax: Math.round(Number(daily.temperature_2m_max && daily.temperature_2m_max[i]) || 0),
        tmin: Math.round(Number(daily.temperature_2m_min && daily.temperature_2m_min[i]) || 0),
        rain: rain,
        wind: Math.round(Number(daily.windspeed_10m_max && daily.windspeed_10m_max[i]) || 0),
        hasRain: rain > 0
      });
    }
    return out;
  }

  var api = {
    WMO_ICONS: WMO_ICONS,
    WMO_DESC: WMO_DESC,
    weatherDayLabel: weatherDayLabel,
    buildWeatherDays: buildWeatherDays
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WeatherCore = api;
})();

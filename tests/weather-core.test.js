import { describe, it, expect } from 'vitest';
import weatherCore from '../js/weather-core.js';

const { weatherDayLabel, buildWeatherDays } = weatherCore;

describe('weatherDayLabel', () => {
  it('retourne les libellés spéciaux J0/J1', () => {
    expect(weatherDayLabel(0, '2026-05-01')).toBe('Aujourd\'hui');
    expect(weatherDayLabel(1, '2026-05-02')).toBe('Demain');
  });
});

describe('buildWeatherDays', () => {
  const daily = {
    time: ['2026-05-01', '2026-05-02', '2026-05-03'],
    weathercode: [0, 63, 999],
    temperature_2m_max: [20.4, 14.6, 10.1],
    temperature_2m_min: [10.2, 8.8, 4.9],
    precipitation_sum: [0, 2.34, 0],
    windspeed_10m_max: [15.2, 32.7, 8.1]
  };

  it('retourne strictement 3 jours', () => {
    const r = buildWeatherDays(daily);
    expect(r).toHaveLength(3);
  });

  it('mappe code connu et fallback inconnu', () => {
    const r = buildWeatherDays(daily);
    expect(r[0].icon).toBe('☀️');
    expect(r[0].desc).toBe('Clair');
    expect(r[2].icon).toBe('🌡️');
    expect(r[2].desc).toBe('');
  });

  it('applique les arrondis température/vent', () => {
    const r = buildWeatherDays(daily);
    expect(r[0].tmax).toBe(20);
    expect(r[1].tmin).toBe(9);
    expect(r[1].wind).toBe(33);
  });

  it('différencie pluie 0 vs >0', () => {
    const r = buildWeatherDays(daily);
    expect(r[0].hasRain).toBe(false);
    expect(r[1].hasRain).toBe(true);
  });

  it('renvoie [] si payload invalide ou incomplet', () => {
    expect(buildWeatherDays(null)).toEqual([]);
    expect(buildWeatherDays({ time: ['2026-05-01'] })).toEqual([]);
  });
});

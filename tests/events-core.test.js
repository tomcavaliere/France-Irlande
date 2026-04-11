import { describe, it, expect, vi } from 'vitest';
import eventsCore from '../js/events-core.js';

const { createBus } = eventsCore;

describe('events-core', () => {
  it('appelle tous les listeners dans l\'ordre d\'abonnement', () => {
    const bus = createBus();
    const calls = [];
    bus.on('x', () => calls.push('a'));
    bus.on('x', () => calls.push('b'));
    bus.on('x', () => calls.push('c'));
    bus.emit('x');
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('passe le payload à chaque listener', () => {
    const bus = createBus();
    const received = [];
    bus.on('p', (d) => received.push(d));
    bus.on('p', (d) => received.push(d));
    bus.emit('p', { k: 42 });
    expect(received).toEqual([{ k: 42 }, { k: 42 }]);
  });

  it('emit sans listeners est un no-op', () => {
    const bus = createBus();
    expect(() => bus.emit('nothing')).not.toThrow();
  });

  it('off() supprime un listener précis', () => {
    const bus = createBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('x', b);
    bus.off('x', a);
    bus.emit('x');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('le unsubscribe retourné par on() supprime le listener', () => {
    const bus = createBus();
    const fn = vi.fn();
    const unsub = bus.on('x', fn);
    unsub();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('off() pendant emit() ne saute pas les listeners restants', () => {
    const bus = createBus();
    const calls = [];
    const b = () => calls.push('b');
    bus.on('x', () => { calls.push('a'); bus.off('x', b); });
    bus.on('x', b);
    bus.on('x', () => calls.push('c'));
    bus.emit('x');
    // Snapshot pris avant dispatch → b est quand même appelé ce tour-ci.
    expect(calls).toEqual(['a', 'b', 'c']);
    // Mais au tour suivant, b a bien été retiré.
    calls.length = 0;
    bus.emit('x');
    expect(calls).toEqual(['a', 'c']);
  });

  it('une exception dans un listener n\'arrête pas les autres', () => {
    const bus = createBus();
    const calls = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.on('x', () => calls.push('a'));
    bus.on('x', () => { throw new Error('boom'); });
    bus.on('x', () => calls.push('c'));
    bus.emit('x');
    expect(calls).toEqual(['a', 'c']);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('clear(name) retire uniquement les listeners d\'un event', () => {
    const bus = createBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('y', b);
    bus.clear('x');
    bus.emit('x');
    bus.emit('y');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('clear() sans nom retire tout', () => {
    const bus = createBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('x', a);
    bus.on('y', b);
    bus.clear();
    bus.emit('x');
    bus.emit('y');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('deux bus créés via createBus() sont indépendants', () => {
    const a = createBus();
    const b = createBus();
    const fn = vi.fn();
    a.on('x', fn);
    b.emit('x');
    expect(fn).not.toHaveBeenCalled();
    a.emit('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

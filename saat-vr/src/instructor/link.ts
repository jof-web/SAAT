// instructor-link: transporte substituível. MVP: window.open + postMessage (mesma máquina).
// Fase 2: implementar Transport sobre WebRTC/WebSocket com a mesma interface.
export interface Transport { send(msg: any): void; onMessage(cb: (msg: any) => void): void; close(): void; readonly kind: string }

/** Canal entre o app e a janela do console. Em file:// a origem é "null": valida-se pela referência da janela. */
export class PostMessageTransport implements Transport {
  kind = 'postMessage'; private cbs: ((m: any) => void)[] = []; private h: (e: MessageEvent) => void;
  constructor(private peer: () => Window | null) {
    this.h = (e: MessageEvent) => { if (e.source && e.source === this.peer() && e.data?.__se) this.cbs.forEach((cb) => cb(e.data.m)); };
    window.addEventListener('message', this.h);
  }
  send(m: any) { const p = this.peer(); if (p && !p.closed) p.postMessage({ __se: 1, m }, '*'); }
  onMessage(cb: (m: any) => void) { this.cbs.push(cb); }
  close() { window.removeEventListener('message', this.h); }
}
/** Fallback: console acoplado na mesma janela (pop-up bloqueado). */
export class LoopbackTransport implements Transport {
  kind = 'loopback'; peerT!: LoopbackTransport; private cbs: ((m: any) => void)[] = [];
  static pair(): [LoopbackTransport, LoopbackTransport] { const a = new LoopbackTransport(), b = new LoopbackTransport(); a.peerT = b; b.peerT = a; return [a, b]; }
  send(m: any) { const c = structuredClone(m); queueMicrotask(() => this.peerT.cbs.forEach((cb) => cb(c))); }
  onMessage(cb: (m: any) => void) { this.cbs.push(cb); }
  close() { this.cbs = []; }
}

// Transport for team rooms. Three tiers, tried in this order:
//  1. Supabase Realtime broadcast channels (when VITE_SUPABASE_* is configured): works across devices.
//  2. Peer-to-peer WebRTC (PeerJS): the room host's browser relays messages to the other players. Works
//     across devices with no server of our own. Only connection set-up goes through the public PeerJS broker.
//  3. BroadcastChannel: same-browser tabs only (used when the others cannot connect).
import type { RoleId } from '../engine/types';

export type MsgKind = 'hello' | 'sync' | 'state' | 'patch' | 'role' | 'ready' | 'req' | 'resp' | 'chat' | 'launch' | 'screen' | 'decide' | 'leave';
export interface Msg { k: MsgKind; from: string; ts: number; d: any }

export interface Transport {
  kind: 'supabase' | 'p2p' | 'local';
  send(m: Msg): void;
  close(): void;
}

export interface MemberInfo { id: string; name: string; roles: RoleId[]; ready: boolean; joinedAt: number; seen: number }

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
export const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

type Status = 'connecting' | 'online' | 'offline';

function localTransport(room: string, onMsg: (m: Msg) => void, onStatus: (s: Status) => void): Transport {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(room) : null;
  if (bc) bc.onmessage = (e) => onMsg(e.data as Msg);
  setTimeout(() => onStatus(bc ? 'online' : 'offline'), 50);
  return { kind: 'local', send(m) { bc?.postMessage(m); }, close() { bc?.close(); } };
}

function supabaseTransport(room: string, onMsg: (m: Msg) => void, onStatus: (s: Status) => void): Transport {
  let channel: any = null;
  let ready = false;
  let closed = false;
  const queue: Msg[] = [];
  onStatus('connecting');
  (async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(SUPABASE_URL!, SUPABASE_KEY!, { realtime: { params: { eventsPerSecond: 20 } }, auth: { persistSession: false, autoRefreshToken: false } });
      channel = client.channel(room, { config: { broadcast: { self: false, ack: false } } });
      channel.on('broadcast', { event: 'm' }, (p: { payload: Msg }) => onMsg(p.payload));
      channel.subscribe((status: string) => {
        if (closed) return;
        if (status === 'SUBSCRIBED') {
          ready = true;
          onStatus('online');
          while (queue.length) channel.send({ type: 'broadcast', event: 'm', payload: queue.shift() });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          ready = false;
          onStatus('offline');
        }
      });
      (channel as any).__client = client;
    } catch {
      onStatus('offline');
    }
  })();
  return {
    kind: 'supabase',
    send(m) {
      if (closed) return;
      if (ready && channel) channel.send({ type: 'broadcast', event: 'm', payload: m });
      else if (queue.length < 100) queue.push(m);
    },
    close() {
      closed = true;
      try { channel?.unsubscribe(); channel?.__client?.removeAllChannels?.(); } catch { /* ignore */ }
    },
  };
}

/** Star topology: the host peer accepts connections and relays every message to the other players. */
function p2pTransport(code: string, isHost: boolean, onMsg: (m: Msg) => void, onStatus: (s: Status) => void, fallback: () => void): Transport {
  const peerId = `catalyx-room-${code.toLowerCase()}`;
  let peer: any = null;
  let closed = false;
  let failed = false;
  let hostConns: any[] = [];
  let clientConn: any = null;
  let online = false;
  const queue: Msg[] = [];
  const fail = () => {
    if (closed || failed || online) return;
    failed = true;
    try { peer?.destroy(); } catch { /* ignore */ }
    fallback();
  };
  onStatus('connecting');
  const timer = setTimeout(fail, 9000);
  (async () => {
    try {
      const { Peer } = await import('peerjs');
      peer = isHost ? new Peer(peerId) : new Peer();
      peer.on('error', () => { if (!online) fail(); else onStatus('offline'); });
      if (isHost) {
        peer.on('open', () => { online = true; clearTimeout(timer); onStatus('online'); });
        peer.on('connection', (c: any) => {
          c.on('open', () => { hostConns.push(c); });
          c.on('data', (d: Msg) => {
            onMsg(d);
            for (const o of hostConns) if (o !== c && o.open) o.send(d);
          });
          c.on('close', () => { hostConns = hostConns.filter((x) => x !== c); });
        });
      } else {
        peer.on('open', () => {
          clientConn = peer.connect(peerId, { reliable: true });
          clientConn.on('open', () => {
            online = true; clearTimeout(timer); onStatus('online');
            while (queue.length) clientConn.send(queue.shift());
          });
          clientConn.on('data', (d: Msg) => onMsg(d));
          clientConn.on('close', () => onStatus('offline'));
          clientConn.on('error', () => { if (!online) fail(); });
        });
      }
    } catch {
      fail();
    }
  })();
  return {
    kind: 'p2p',
    send(m) {
      if (closed) return;
      if (isHost) { for (const c of hostConns) if (c.open) c.send(m); }
      else if (clientConn?.open) clientConn.send(m);
      else if (queue.length < 100) queue.push(m);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      try { peer?.destroy(); } catch { /* ignore */ }
    },
  };
}

export function openTransport(code: string, onMsg: (m: Msg) => void, onStatus: (s: Status) => void, isHost = false, onKind?: (k: Transport['kind']) => void): Transport {
  const room = `catalyx-${code.toUpperCase()}`;
  if (hasSupabase) return supabaseTransport(room, onMsg, onStatus);
  // Peer-to-peer first; if it cannot connect, quietly fall back to same-browser sync.
  let inner: Transport;
  let usingLocal = false;
  inner = p2pTransport(code, isHost, onMsg, onStatus, () => {
    usingLocal = true;
    inner = localTransport(room, onMsg, onStatus);
    onKind?.('local');
  });
  return {
    get kind() { return usingLocal ? 'local' : inner.kind; },
    send(m) {
      inner.send(m);
      // While peer-to-peer is still connecting, also post to same-browser tabs so nothing is lost locally.
    },
    close() { inner.close(); },
  } as Transport;
}

export function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export const randomId = () => Math.random().toString(36).slice(2, 10);

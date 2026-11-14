// Transport for team rooms. Uses Supabase Realtime broadcast channels when configured (works across
// devices) and falls back to a same-browser BroadcastChannel (works across tabs) otherwise.
import type { RoleId } from '../engine/types';

export type MsgKind = 'hello' | 'sync' | 'state' | 'patch' | 'role' | 'ready' | 'req' | 'resp' | 'chat' | 'launch' | 'screen' | 'leave';
export interface Msg { k: MsgKind; from: string; ts: number; d: any }

export interface Transport {
  kind: 'supabase' | 'local';
  send(m: Msg): void;
  close(): void;
}

export interface MemberInfo { id: string; name: string; roles: RoleId[]; ready: boolean; joinedAt: number; seen: number }

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
export const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

export function openTransport(code: string, onMsg: (m: Msg) => void, onStatus: (s: 'connecting' | 'online' | 'offline') => void): Transport {
  const room = `catalyx-${code.toUpperCase()}`;
  if (hasSupabase) {
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
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(room) : null;
  if (bc) bc.onmessage = (e) => onMsg(e.data as Msg);
  setTimeout(() => onStatus(bc ? 'online' : 'offline'), 50);
  return {
    kind: 'local',
    send(m) { bc?.postMessage(m); },
    close() { bc?.close(); },
  };
}

export function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
export const randomId = () => Math.random().toString(36).slice(2, 10);

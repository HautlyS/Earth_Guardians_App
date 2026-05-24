/**
 * Earth Guardians - STUN Server List
 * Comprehensive list of free STUN servers for WebRTC P2P connectivity
 */

export interface STUNServer {
  host: string;
  port: number;
  provider?: string;
  region?: string;
}

export const FREE_STUN_SERVERS: STUNServer[] = [
  { host: 'stun.l.google.com', port: 19302, provider: 'Google', region: 'Global' },
  { host: 'stun1.l.google.com', port: 19302, provider: 'Google', region: 'Global' },
  { host: 'stun2.l.google.com', port: 19302, provider: 'Google', region: 'Global' },
  { host: 'stun3.l.google.com', port: 19302, provider: 'Google', region: 'Global' },
  { host: 'stun4.l.google.com', port: 19302, provider: 'Google', region: 'Global' },
  { host: 'global.stun.twilio.com', port: 3478, provider: 'Twilio', region: 'Global' },
  { host: 'stun.mxit.com', port: 3478, provider: 'Mxit', region: 'Global' },
  { host: 'edge.sip.facebook.com', port: 3478, provider: 'Facebook', region: 'Global' },
  { host: 'stun.services.mozilla.com', port: 3478, provider: 'Mozilla', region: 'Global' },
  { host: 'xirsys.com', port: 3478, provider: 'Xirsys', region: 'Global' },
  { host: 'stunserver.org', port: 3478, provider: 'StunServer', region: 'Global' },
  { host: 'stun.stunprotocol.org', port: 3478, provider: 'STUNProtocol', region: 'Global' },
  { host: 'stun.sipgate.net', port: 3478, provider: 'Sipgate', region: 'Europe' },
  { host: 'numb.viagenie.ca', port: 3478, provider: 'Viagenie', region: 'Global' },
  { host: 'stun.freeswitch.org', port: 3478, provider: 'FreeSWITCH', region: 'Global' },
];

export const P2P_CONFIG = {
  stunServers: FREE_STUN_SERVERS,
  relayEnabled: true,
  maxConnections: 50,
  chunkSize: 65536,
  connectionTimeout: 30000,
  heartbeatInterval: 30000,
};

export function getRandomSTUNServer(): STUNServer {
  return FREE_STUN_SERVERS[Math.floor(Math.random() * FREE_STUN_SERVERS.length)];
}

export function getSTUNServers(): STUNServer[] {
  return [...FREE_STUN_SERVERS];
}

/**
 * STUN Server Configuration
 * 
 * Uses free, always-online STUN servers from pradt2/always-online-stun
 * Refreshed hourly from: https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt
 * 
 * Last updated: 2026-05-24
 */

export interface STUNServer {
  host: string;
  port: number;
  url: string;
}

// Default fallback STUN servers (always available)
const DEFAULT_STUN_SERVERS: STUNServer[] = [
  { host: 'stun.l.google.com', port: 19302, url: 'stun.l.google.com:19302' },
  { host: 'stun1.l.google.com', port: 19302, url: 'stun1.l.google.com:19302' },
  { host: 'stun2.l.google.com', port: 19302, url: 'stun2.l.google.com:19302' },
  { host: 'stun3.l.google.com', port: 19302, url: 'stun3.l.google.com:19302' },
  { host: 'stun4.l.google.com', port: 19302, url: 'stun4.l.google.com:19302' },
];

// Free STUN servers from always-online-stun (primary list)
export const FREE_STUN_SERVERS: STUNServer[] = [
  { host: 'stun.ipfire.org', port: 3478, url: 'stun.ipfire.org:3478' },
  { host: 'stun.files.fm', port: 3478, url: 'stun.files.fm:3478' },
  { host: 'stun.alpirsbacher.de', port: 3478, url: 'stun.alpirsbacher.de:3478' },
  { host: 'stun.grazertrinkwasseringefahr.at', port: 3478, url: 'stun.grazertrinkwasseringefahr.at:3478' },
  { host: 'stun.graftlab.com', port: 3478, url: 'stun.graftlab.com:3478' },
  { host: 'stun.voip.blackberry.com', port: 3478, url: 'stun.voip.blackberry.com:3478' },
  { host: 'stun.zentauron.de', port: 3478, url: 'stun.zentauron.de:3478' },
  { host: 'stun.peethultra.be', port: 3478, url: 'stun.peethultra.be:3478' },
  { host: 'stun.kanojo.de', port: 3478, url: 'stun.kanojo.de:3478' },
  { host: 'stun.nanocosmos.de', port: 3478, url: 'stun.nanocosmos.de:3478' },
  { host: 'stun.godatenow.com', port: 3478, url: 'stun.godatenow.com:3478' },
  { host: 'stun.pure-ip.com', port: 3478, url: 'stun.pure-ip.com:3478' },
  { host: 'stun.engineeredarts.co.uk', port: 3478, url: 'stun.engineeredarts.co.uk:3478' },
  { host: 'stun.thinkrosystem.com', port: 3478, url: 'stun.thinkrosystem.com:3478' },
  { host: 'stun.verbo.be', port: 3478, url: 'stun.verbo.be:3478' },
  { host: 'stun.vomessen.de', port: 3478, url: 'stun.vomessen.de:3478' },
  { host: 'stun.linuxtrent.it', port: 3478, url: 'stun.linuxtrent.it:3478' },
  { host: 'stun.baltmannsweiler.de', port: 3478, url: 'stun.baltmannsweiler.de:3478' },
  { host: 'stun.voipgate.com', port: 3478, url: 'stun.voipgate.com:3478' },
  { host: 'stun.antisip.com', port: 3478, url: 'stun.antisip.com:3478' },
  { host: 'stun.uabrides.com', port: 3478, url: 'stun.uabrides.com:3478' },
  { host: 'stun.nextcloud.com', port: 3478, url: 'stun.nextcloud.com:3478' },
  { host: 'stun.yesdates.com', port: 3478, url: 'stun.yesdates.com:3478' },
  { host: 'stun.finsterwalder.com', port: 3478, url: 'stun.finsterwalder.com:3478' },
  { host: 'stun.atagverwarming.nl', port: 3478, url: 'stun.atagverwarming.nl:3478' },
  { host: 'stun.m-online.net', port: 3478, url: 'stun.m-online.net:3478' },
  { host: 'stun.telviva.com', port: 3478, url: 'stun.telviva.com:3478' },
  { host: 'stun.freeswitch.org', port: 3478, url: 'stun.freeswitch.org:3478' },
  { host: 'stun.ukh.de', port: 3478, url: 'stun.ukh.de:3478' },
  { host: 'stun.siplogin.de', port: 3478, url: 'stun.siplogin.de:3478' },
  { host: 'stun.f.haeder.net', port: 3478, url: 'stun.f.haeder.net:3478' },
  { host: 'stun.romancecompass.com', port: 3478, url: 'stun.romancecompass.com:3478' },
  { host: 'stun.bcs2005.net', port: 3478, url: 'stun.bcs2005.net:3478' },
  { host: 'stun.bridesbay.com', port: 3478, url: 'stun.bridesbay.com:3478' },
  { host: 'stun.telnyx.com', port: 3478, url: 'stun.telnyx.com:3478' },
  { host: 'stun.sipthor.net', port: 3478, url: 'stun.sipthor.net:3478' },
  { host: 'stun.radiojar.com', port: 3478, url: 'stun.radiojar.com:3478' },
  { host: 'stun.genymotion.com', port: 3478, url: 'stun.genymotion.com:3478' },
  { host: 'stun.geesthacht.de', port: 3478, url: 'stun.geesthacht.de:3478' },
  { host: 'stun.nextcloud.com', port: 443, url: 'stun.nextcloud.com:443' },
  { host: 'stun.fmo.de', port: 3478, url: 'stun.fmo.de:3478' },
  { host: 'stun.stochastix.de', port: 3478, url: 'stun.stochastix.de:3478' },
  { host: 'stun.ringostat.com', port: 3478, url: 'stun.ringostat.com:3478' },
  { host: 'stun.moonlight-stream.org', port: 3478, url: 'stun.moonlight-stream.org:3478' },
  { host: 'stun.hot-chilli.net', port: 3478, url: 'stun.hot-chilli.net:3478' },
  { host: 'stun.sonetel.com', port: 3478, url: 'stun.sonetel.com:3478' },
  { host: 'stun.lebendigefluesse.at', port: 3478, url: 'stun.lebendigefluesse.at:3478' },
  { host: 'stun.dcalling.de', port: 3478, url: 'stun.dcalling.de:3478' },
  { host: 'stun.poetamatusel.org', port: 3478, url: 'stun.poetamatusel.org:3478' },
  { host: 'stun.voztovoice.org', port: 3478, url: 'stun.voztovoice.org:3478' },
];

// STUN server list URL (hourly refreshed)
export const STUN_LIST_URL = 'https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt';

// Combine all servers with priority
export function getAllSTUNServers(): STUNServer[] {
  return [...FREE_STUN_SERVERS, ...DEFAULT_STUN_SERVERS];
}

// Get random server from list
export function getRandomSTUNServer(): STUNServer {
  const servers = getAllSTUNServers();
  return servers[Math.floor(Math.random() * servers.length)];
}

// Get multiple servers for redundancy
export function getSTUNServers(count: number = 5): STUNServer[] {
  const servers = getAllSTUNServers();
  const shuffled = [...servers].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Configuration for P2P
export const P2P_CONFIG = {
  stunServers: getAllSTUNServers(),
  stunTimeout: 5000, // 5 seconds
  stunRetries: 3,
  iceServers: getAllSTUNServers().map(server => ({
    urls: `stun:${server.host}:${server.port}`,
  })),
  relayServers: [
    // TURN servers for when STUN fails (can add free TURN servers)
    // Note: Free TURN servers are scarce, most require authentication
  ],
};

export default {
  FREE_STUN_SERVERS,
  DEFAULT_STUN_SERVERS,
  STUN_LIST_URL,
  P2P_CONFIG,
  getRandomSTUNServer,
  getSTUNServers,
  getAllSTUNServers,
};

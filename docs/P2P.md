# P2P Networking Documentation

## Overview

The Earth Guardians platform uses WebRTC for peer-to-peer communication, enabling direct connections between users without relying on central servers.

## Architecture

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│  Peer A │◄───────►│ Signal  │◄───────►│  Peer B │
└────┬────┘         └─────────┘         └────┬────┘
     │                                       │
     │     Direct WebRTC Connection          │
     └───────────────────────────────────────┘
     
     ┌─────────────────────────────────────┐
     │           P2P Data Flow             │
     ├─────────────────────────────────────┤
     │  Data → Compress (WASM) → Chunk →   │
     │  Send via DataChannel → Receive →   │
     │  Decompress (WASM) → Data           │
     └─────────────────────────────────────┘
```

## Key Components

### P2PManager
Main class managing peer connections.

```typescript
import { p2pManager } from '@/p2p/p2p-manager'

// Get connection stats
const stats = p2pManager.getStats()
console.log(`Connected to ${stats.connectedPeers} peers`)

// Listen for events
p2pManager.on('connected', (data) => {
  console.log('New peer connected:', data.peerId)
})

p2pManager.on('disconnected', (data) => {
  console.log('Peer disconnected:', data.peerId)
})

p2pManager.on('data', (data) => {
  console.log('Received data from:', data.peerId)
})
```

### Connection Flow

1. **Create Connection**
```typescript
const connection = p2pManager.createConnection(peerId)
```

2. **Exchange Offers**
```typescript
// Peer A creates offer
const offer = await p2pManager.createOffer(peerId)
// Send offer via signaling server

// Peer B receives offer
const answer = await p2pManager.handleOffer(peerId, offer)
// Send answer via signaling server

// Peer A receives answer
await p2pManager.handleAnswer(peerId, answer)
```

3. **Exchange ICE Candidates**
```typescript
// Handle ICE candidates
await p2pManager.handleCandidate(peerId, candidate)
```

4. **Send Data**
```typescript
p2pManager.send(peerId, { type: 'message', content: 'Hello!' })
```

## STUN Servers

Pre-configured STUN servers for NAT traversal:

```typescript
import { FREE_STUN_SERVERS } from '@/p2p/stun-servers'

console.log('Available STUN servers:', FREE_STUN_SERVERS)
```

## File Transfer

### Sending Files
```typescript
const fileInput = document.querySelector('input[type="file"]')
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  await p2pManager.sendFile(peerId, file)
})

p2pManager.on('transfer-progress', (data) => {
  console.log(`Progress: ${data.progress}%`)
})
```

### Receiving Files
```typescript
p2pManager.on('file-start', (data) => {
  console.log(`Receiving: ${data.fileName} (${data.totalChunks} chunks)`)
})

p2pManager.on('file-complete', (data) => {
  console.log(`Received: ${data.fileName}`)
})
```

## Configuration

```typescript
const config: P2PConfig = {
  stunServers: FREE_STUN_SERVERS,
  relayEnabled: true,
  maxConnections: 50,
  chunkSize: 65536  // 64KB chunks
}

const p2p = new P2PManager(config)
```

## Best Practices

### Connection Management
- Limit maximum connections to prevent resource exhaustion
- Implement connection timeout handling
- Gracefully handle peer disconnection

### Data Handling
- Use compression for large data transfers
- Implement chunking for files over 64KB
- Handle out-of-order delivery for unreliable channels

### Security
- Verify peer identity before establishing connection
- Encrypt sensitive data end-to-end
- Implement message signing for integrity

## Troubleshooting

### Connection Issues

1. **NAT Traversal Failure**
   - Check STUN server availability
   - Enable TURN relay as fallback
   - Verify firewall rules

2. **ICE Candidate Gathering**
   - Use more STUN servers
   - Check network connectivity
   - Enable verbose logging

### Data Transfer Issues

1. **Slow Transfer Speeds**
   - Increase chunk size
   - Use parallel connections
   - Compress data before sending

2. **Connection Drops**
   - Implement reconnection logic
   - Use connection keep-alive
   - Handle network changes

## Future Enhancements

- [ ] TURN server integration
- [ ] WebRTC DataChannel multiplexing
- [ ] Relay server fallback
- [ ] BitTorrent-style chunk distribution
- [ ] DHT-based peer discovery
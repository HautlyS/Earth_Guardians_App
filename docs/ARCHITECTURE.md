# Architecture Documentation

## Overview

The Earth Guardians platform is a multi-layered application built with modern technologies to provide a collaborative, offline-first experience with P2P capabilities.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web App       │  Desktop App    │     Mobile App              │
│   (Vue 3)       │   (Tauri)       │     (Capacitor)            │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                │                       │
         ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebAssembly Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ Compression│  │  Hashing    │  │   P2P Utils │               │
│  │   (LZ77)   │  │  (Custom)   │  │  (Crypto)   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                      Rust + wasm-bindgen                         │
└─────────────────────────────────────────────────────────────────┘
         │                │                       │
         ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browser APIs                                   │
│  WebRTC │ WebSocket │ IndexedDB │ Service Workers                │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Supabase      │   P2P Network  │   External APIs             │
│   - Auth        │   - Signaling   │   - STUN/TURN              │
│   - Database    │   - Transport   │   - IPFS (future)          │
│   - Realtime    │   - Discovery   │   - Filecoin (future)      │
│   - Storage     │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## 🗂️ Project Structure

### Apps

#### Web Application (`apps/web/`)
- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite 5
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **Styling**: CSS Variables + Neo-brutalist design system

```
apps/web/
├── src/
│   ├── components/      # Reusable Vue components
│   ├── composables/     # Vue composition functions
│   ├── stores/          # Pinia state stores
│   ├── views/           # Page-level components
│   ├── router/          # Vue Router configuration
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── public/              # Static assets
├── tests/               # Vitest test files
└── dist/                # Build output
```

#### Desktop Application (`apps/desktop/`)
- **Framework**: Tauri 2.0
- **Backend**: Rust
- **Frontend**: Vue 3 (same as web)
- **Native Features**:
  - File system access
  - System notifications
  - Global shortcuts
  - Clipboard operations

```
apps/desktop/
├── src/                 # Rust backend source
├── src-tauri/           # Tauri configuration
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   └── lib.rs       # Library code
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/           # App icons
└── package.json
```

### Packages

#### Shared Library (`packages/shared/`)
- **Language**: Rust
- **Target**: WebAssembly
- **Build Tool**: wasm-pack

```
packages/shared/
├── src/
│   ├── lib.rs           # Main library entry
│   ├── compressor.rs    # LZ77 compression
│   ├── hasher.rs        # Hash functions
│   └── p2p_utils.rs     # P2P utilities
├── pkg/                 # WASM output (generated)
├── Cargo.toml
└── package.json
```

### Core Modules

#### P2P Networking (`src/p2p/`)
- **Protocol**: WebRTC
- **Signaling**: WebSocket-based
- **NAT Traversal**: STUN/TURN

```
src/p2p/
├── p2p-manager.ts       # Main P2P manager
├── stun-servers.ts       # STUN server config
├── signaling.ts          # WebSocket signaling
├── peer-connection.ts    # WebRTC connection
└── data-channel.ts      # Data channel handling
```

#### Supabase Backend (`supabase/`)
- **Database**: PostgreSQL
- **Auth**: Supabase Auth
- **Realtime**: Supabase Realtime
- **Storage**: Supabase Storage

```
supabase/
├── functions/           # Edge functions
│   └── _shared/         # Shared code
├── migrations/          # DB migrations
│   └── 001_*.sql        # Migration files
├── config.toml          # Supabase config
└── seed.sql             # Database seed
```

## 🔄 Data Flow

### P2P Communication Flow

```
┌─────────┐    WebSocket    ┌─────────┐    WebRTC    ┌─────────┐
│  Peer A │◄──────────────►│ Signal  │◄────────────►│  Peer B │
└────┬────┘                └─────────┘              └────┬────┘
     │                                                  │
     │         Direct P2P Connection                    │
     └──────────────────────────────────────────────────┘
```

1. **Signaling Phase**: Peers exchange SDP offers/answers via WebSocket
2. **ICE Candidates**: Exchange network information via signaling
3. **Connection Established**: WebRTC peer connection created
4. **Data Transfer**: Reliable data channels for messages, unreliable for signaling

### WASM Data Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Vue App   │───►│   Vite      │───►│   Browser   │
│             │    │  (bundler)  │    │             │
└─────────────┘    └─────────────┘    └──────┬───────┘
                                            │
                                            ▼
                                    ┌─────────────┐
                                    │  WASM Module│
                                    │   (Rust)    │
                                    └─────────────┘
                                            │
                                            ▼
                                    ┌─────────────┐
                                    │   Native    │
                                    │  Performance│
                                    └─────────────┘
```

## 🔐 Security Architecture

### Authentication Flow

```
┌─────────┐     ┌────────────┐     ┌────────────┐
│  User   │────►│   Supabase │────►│    JWT     │
│         │◄────│    Auth    │◄────│   Token    │
└─────────┘     └────────────┘     └────────────┘
```

1. User submits credentials
2. Supabase validates and returns JWT
3. JWT stored in localStorage/sessionStorage
4. All API requests include JWT in Authorization header

### P2P Security

- **Peer Authentication**: Verify peer identity via Supabase Auth
- **End-to-End Encryption**: DTLS for WebRTC connections
- **Data Signing**: Sign messages with user's private key

## 📊 State Management

### Pinia Store Architecture

```
┌─────────────────────────────────────────────────┐
│                   Pinia Stores                   │
├─────────────┬─────────────┬─────────┬───────────┤
│    User     │   Projects  │  P2P    │  Settings │
│   Store     │   Store     │ Store   │   Store   │
└─────────────┴─────────────┴─────────┴───────────┘
```

### State Persistence

- **LocalStorage**: User preferences, theme
- **IndexedDB**: Offline data cache
- **SessionStorage**: Temporary auth tokens

## 🔧 Build Configuration

### Build Environments

| Environment | Base URL | Features |
|-------------|----------|----------|
| Development | localhost:3000 | Hot reload, debug logs |
| Staging | staging.earthguardians.org | Source maps, test DB |
| Production | earthguardians.org | Minified, optimized |

### WASM Build Targets

| Target | Use Case | Output |
|--------|----------|--------|
| web | Browser | ES modules |
| nodejs | Server-side | CommonJS |

## 📈 Performance Optimization

### Bundle Optimization

- **Code Splitting**: Vue Router-based chunks
- **Tree Shaking**: ES modules + Rollup
- **Compression**: Gzip + Brotli

### WASM Optimization

- **Link-Time Optimization (LTO)**: Reduces binary size
- **Optimized Build**: `-C opt-level=s`
- **Lazy Loading**: Load WASM on demand

### Caching Strategy

- **Service Workers**: Cache static assets
- **CDN**: Deploy to CDN for global access
- **Browser Cache**: HTTP caching headers

## 🔮 Future Architecture

### Planned Features

1. **IPFS Integration**: Decentralized file storage
2. **Filecoin Storage**: Permanent data archival
3. **Multi-chain Support**: Polygon/Arbitrum for DAOs
4. **GraphQL API**: Flexible data querying

### Scalability Considerations

- **Horizontal Scaling**: Stateless app servers
- **CDN**: Global content distribution
- **Edge Computing**: Supabase Edge Functions

---

Last Updated: 2024-05-24
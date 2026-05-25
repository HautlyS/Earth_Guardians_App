# Earth Guardians Platform

![CI](https://github.com/earth-guardians/platform/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/earth-guardians/platform/actions/workflows/release.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![Rust](https://img.shields.io/badge/rust-stable-orange.svg)

A neo-brutalist collaborative platform for Earth Guardians NGO featuring P2P networking, WebAssembly performance optimization, and decentralized storage.

## 🌟 Features

- **P2P Networking**: Built on WebRTC for peer-to-peer communication
- **WebAssembly Performance**: Rust-powered compression, hashing, and crypto operations
- **Neo-Brutalist Design**: Bold typography, stark contrasts, and raw aesthetics
- **Cross-Platform**: Web, Desktop (Tauri), and Mobile (Capacitor) support
- **Real-time Sync**: Supabase-powered real-time database and presence
- **Offline-First**: Service workers and local storage for offline operation

## 📋 Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Rust >= stable (for WASM and Tauri builds)
- wasm-pack (for WebAssembly compilation)
- Docker & Docker Compose (for local Supabase)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/earth-guardians/platform.git
cd platform

# Install dependencies
pnpm install

# Start local Supabase
docker-compose up -d

# Build WASM modules
pnpm build:wasm

# Start development
pnpm dev
```

## 📦 Project Structure

```
earth-guardians-platform/
├── apps/
│   ├── web/          # Vue.js web application
│   └── desktop/      # Tauri desktop application
├── packages/
│   └── shared/       # Rust WASM shared library
├── src/
│   └── p2p/          # P2P networking utilities
├── supabase/         # Supabase configuration
├── .github/
│   └── workflows/    # GitHub Actions CI/CD
└── docs/             # Documentation
```

## 🛠️ Available Scripts

### Development
```bash
pnpm dev              # Start all apps in dev mode
pnpm dev:web          # Start web app only
pnpm dev:desktop      # Start desktop app only
pnpm dev:wasm         # Build WASM and start web
```

### Building
```bash
pnpm build            # Build all (WASM + apps)
pnpm build:wasm       # Build WebAssembly modules
pnpm build:web        # Build web app
pnpm build:desktop     # Build desktop app
pnpm build:all        # Build everything
```

### Testing & Quality
```bash
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run with coverage
pnpm lint             # Lint all packages
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code
pnpm typecheck         # Type check all packages
```

### Database
```bash
pnpm supabase:start   # Start local Supabase
pnpm supabase:stop    # Stop local Supabase
pnpm db:migrate        # Push migrations
pnpm db:reset          # Reset database
pnpm db:seed           # Seed database
```

## 🏗️ Architecture

### Web Application (Vue 3)
- **Framework**: Vue 3 + Composition API
- **State Management**: Pinia
- **Routing**: Vue Router
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)

### Desktop Application (Tauri)
- **Framework**: Tauri 2.0 (Rust backend)
- **Frontend**: Vue 3
- **Native Features**: File system, notifications, clipboard

### WASM Module (Rust)
- **Compression**: LZ77-based compression
- **Hashing**: Custom hash functions
- **P2P Utils**: Peer ID generation, crypto operations

### P2P Layer
- **Protocol**: WebRTC
- **Signaling**: WebSocket-based
- **NAT Traversal**: STUN/TURN servers

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=http://localhost:4000
VITE_SUPABASE_ANON_KEY=your-anon-key

# Development
VITE_DEV_HOST=false
VITE_HTTPS=false

# API
VITE_API_URL=http://localhost:4000
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run coverage
pnpm test:coverage

# Run specific package
pnpm --filter @earth-guardians/web test
```

## 📱 Building for Mobile

### Android
```bash
pnpm build:web
cd apps/web
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

### iOS
```bash
pnpm build:web
cd apps/web
npx cap add ios
npx cap sync ios
cd ios && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' build
```

## 🐳 Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📖 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [API Reference](docs/API.md)
- [WASM Development](docs/WASM.md)
- [P2P Networking](docs/P2P.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our development workflow.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Vue.js](https://vuejs.org/) - The progressive JavaScript framework
- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop apps
- [Supabase](https://supabase.com/) - The open source Firebase alternative
- [Rust](https://rust-lang.org/) - A language empowering everyone to build reliable software

---

Built with ❤️ by Earth Guardians Team
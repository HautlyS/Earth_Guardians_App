# Contributing to Earth Guardians Platform

Thank you for your interest in contributing to the Earth Guardians platform! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Code Style](#code-style)
- [Documentation](#documentation)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## 📜 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. We expect:

- Be respectful and considerate in your communication
- Accept constructive feedback gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Rust >= stable
- wasm-pack
- Docker (for local Supabase)

### Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/earth-guardians/platform.git
   cd platform
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start local services**
   ```bash
   docker-compose up -d
   ```

4. **Build WASM modules**
   ```bash
   pnpm build:wasm
   ```

5. **Start development server**
   ```bash
   pnpm dev
   ```

### Environment Setup

Create a `.env.local` file for local development:

```env
VITE_SUPABASE_URL=http://localhost:4000
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 🔄 Development Workflow

### 1. Create a Branch

Always work on a feature branch:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write code following our style guidelines
- Add tests for new functionality
- Update documentation as needed

### 3. Keep Branch Updated

Regularly rebase your branch to keep it up to date:

```bash
git fetch origin
git rebase origin/main
```

### 4. Run Tests

Before committing, ensure all tests pass:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

### 5. Commit Changes

Follow our commit message format (see below).

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📁 Project Structure

```
platform/
├── apps/
│   ├── web/              # Vue.js web application
│   │   ├── src/
│   │   │   ├── components/   # Vue components
│   │   │   ├── composables/  # Vue composables
│   │   │   ├── stores/       # Pinia stores
│   │   │   ├── views/        # Page views
│   │   │   └── utils/         # Utility functions
│   │   ├── tests/            # Test files
│   │   └── package.json
│   │
│   └── desktop/           # Tauri desktop app
│       ├── src/              # Rust source
│       ├── src-tauri/         # Tauri configuration
│       └── package.json
│
├── packages/
│   └── shared/            # Rust WASM module
│       ├── src/               # Rust source
│       ├── pkg/               # Built WASM output
│       └── Cargo.toml
│
├── src/
│   └── p2p/               # P2P networking utilities
│
├── supabase/
│   ├── functions/         # Edge functions
│   └── migrations/        # Database migrations
│
└── docs/                  # Documentation
```

## ✏️ Making Changes

### Code Standards

- Write clean, readable code
- Follow existing patterns in the codebase
- Add comments for complex logic
- Keep functions small and focused

### File Naming

- Components: `PascalCase.vue` (e.g., `UserProfile.vue`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Composables: `useCamelCase.ts` (e.g., `useAuth.ts`)
- Stores: `camelCase.ts` (e.g., `userStore.ts`)

### TypeScript

- Use strict typing
- Avoid `any` type
- Use interfaces for complex objects
- Export types from a central `types/` directory

## 📝 Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(p2p): add peer connection retry logic
fix(wasm): resolve compression memory leak
docs(readme): update installation instructions
refactor(web): simplify auth composable
test(p2p): add connection state tests
chore(ci): add wasm-pack cache
```

## 🔀 Pull Requests

### PR Requirements

- Descriptive title following commit message format
- Reference related issues
- Pass all CI checks
- Include test coverage for new features
- Update documentation if needed

### PR Description Template

```markdown
## Summary
Brief description of the changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe the testing you performed.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
```

## 🧪 Testing

### Writing Tests

```typescript
// Example Vue component test
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from './MyComponent.vue'

describe('MyComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.text()).toContain('Hello')
  })
})
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific package
pnpm --filter @earth-guardians/web test

# Run in watch mode
pnpm test:watch
```

### Test Coverage

We aim for:
- Minimum 80% code coverage
- Critical paths must have 100% coverage
- All new features must include tests

## 🎨 Code Style

### Prettier Configuration

We use Prettier with these settings:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### ESLint Rules

- Strict TypeScript rules
- Vue 3 composition API preferred
- No console.log in production code
- Prefer composition over options API

### Rust (WASM)

- Follow Rustfmt settings
- Use clippy lints
- Document public APIs
- Write unit tests for public functions

## 📚 Documentation

### Code Documentation

- Document all exported functions
- Add JSDoc comments for complex logic
- Explain "why" not just "what"

### README Updates

- Update README if adding new features
- Include setup instructions
- Document new commands/scripts

### API Documentation

- Document all API endpoints
- Include request/response examples
- Note authentication requirements

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 20.10.0]

## Screenshots
If applicable, add screenshots.

## Additional Context
Any other context about the problem.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Summary
Brief description of the feature.

## Use Case
Who would use this feature and why?

## Proposed Solution
Describe your proposed solution.

## Alternatives Considered
Describe alternative solutions you've considered.

## Additional Context
Any mockups, examples, or references.
```

## 📞 Getting Help

- Open an issue for bugs or feature requests
- Join our community chat (link in README)
- Check existing documentation
- Search GitHub issues before creating new ones

## ✅ PR Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least one maintainer approval
3. **Testing**: Manual testing may be required
4. **Merge**: Squash and merge by maintainer

---

Thank you for contributing to Earth Guardians! 🎉
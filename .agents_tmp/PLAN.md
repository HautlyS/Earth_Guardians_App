# 1. OBJECTIVE

Build a comprehensive **Neo-brutalist** web application for **Earth Guardians NGO** that combines:
- **Social Media** - Feed system with posts, comments, likes, follows
- **Project Management** - Tasks, milestones, Kanban boards, Gantt charts
- **Document Suite** - Forms, spreadsheets, e-signatures, collaborative docs

The application uses **Tauri (Rust) + Nuxt (Vue 3) + WASM** for cross-device support (desktop, web, mobile-ready), with **Supabase Edge Functions** as the only database access layer (no direct DB touches from app).

---

# 2. CONTEXT SUMMARY

## NGO Hierarchical Structure
| Role | Access Level | Capabilities |
|------|-------------|--------------|
| **Staff** | Admin | Full system access, user management, global settings |
| **Regional Crew Councilors** | Regional Manager | Regional feeds, cross-crew projects, reports |
| **Crew Leaders** | Team Lead | Team management, project creation, task assignment |
| **Crew Members** | Standard User | Own tasks, posts, collaborations |
| **Stakeholders** | Read-only | View dashboards, reports, public content |
| **Partners** | External | Limited access, specific project collaboration |

## Technical Architecture
- **Frontend**: Nuxt 3 (Vue 3) with Composition API + TypeScript
- **Desktop**: Tauri (Rust backend) with WASM modules
- **Backend**: Supabase (Postgres) + Edge Functions only
- **Deployment**: GitHub Pages (static) + Tauri desktop builds
- **Styling**: Neo-brutalist (white-black base with full theme switcher)

---

# 3. APPROACH OVERVIEW

## Design Philosophy: Neo-Brutalist
- **Color System**: White/Black base with dynamic theme switching
- **Typography**: Bold geometric fonts (Space Grotesk, JetBrains Mono for code)
- **Elements**: Thick borders (3-4px), sharp corners, high contrast
- **Motion**: Snappy animations, glitch effects, stark reveals

## Architecture Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                    TAURI RUST BACKEND                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  WASM Core  │  │  File Sys   │  │  Native APIs        │  │
│  │  (Shared)   │  │  Access     │  │  (Notifications)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    NUXT 3 FRONTEND                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Pages     │  │ Components │  │ Composables│           │
│  │  /layouts  │  │ /UI Kit    │  │ /State     │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ Auth    │  │ Social  │  │ Projects│  │ Documents    │  │
│  │ Module  │  │ Module  │  │ Module  │  │ Module       │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    POSTGRES DATABASE
```

---

# 4. IMPLEMENTATION STEPS

## Phase 1: Project Foundation (Week 1)
**Goal**: Set up monorepo, Tauri + Nuxt scaffolding, theme system

1. **1.1** Initialize monorepo structure with pnpm workspaces
   - Create `/apps/web` (Nuxt), `/apps/desktop` (Tauri), `/packages/shared` (WASM)
   - Configure pnpm workspace root
   
2. **1.2** Setup Nuxt 3 project with TypeScript
   - Configure nuxt.config.ts with Supabase, Pinia, color mode
   - Setup auto-imports and module system
   
3. **1.3** Create Neo-brutalist theme system (CSS variables)
   - Base themes: Light (white-dominant), Dark (black-dominant), High Contrast
   - CSS custom properties for all design tokens
   - Theme switcher component with persistence
   
4. **1.4** Setup Tauri Rust project
   - Configure Cargo.toml with WASM support
   - Create basic window with native menu
   - Setup IPC bridge between Rust and Vue

## Phase 2: Core Design System (Week 2)
**Goal**: Build complete UI component library

5. **2.1** Typography & Font System
   - Import Space Grotesk (display), Inter (body fallback), JetBrains Mono (code)
   - Create type scale (12px-48px) with line-height ratios
   - Text utility classes
   
6. **2.2** Neo-brutalist Base Components
   - Button (primary, secondary, ghost, destructive variants)
   - Input fields (text, email, password, textarea)
   - Cards with thick borders and shadow offsets
   - Navigation bars with brutalist hover states
   - Modal/Dialog system with backdrop blur
   
7. **2.3** Layout System
   - Grid system (12 columns, responsive breakpoints)
   - Container widths (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
   - Sidebar layouts for app views
   - Full-width layouts for docs/social

## Phase 3: Authentication & User Management (Week 3)
**Goal**: Supabase auth with NGO role system

8. **3.1** Supabase Edge Functions - Auth Module
   - `auth-signup` - User registration with role assignment
   - `auth-login` - Email/password authentication
   - `auth-refresh` - JWT token refresh
   - `auth-logout` - Session termination
   
9. **3.2** User Profile Edge Functions
   - `users-get-profile` - Fetch user with role
   - `users-update-profile` - Update profile data
   - `users-list-by-role` - List users filtered by NGO role
   - `users-search` - Search crew members
   
10. **3.3** Vue Auth Composables
    - `useAuth()` - Login, logout, session management
    - `useUser()` - Current user state with role
    - `usePermission()` - Role-based access checks

## Phase 4: Social Media Module (Week 4)
**Goal**: Full-featured feed system

11. **4.1** Post Edge Functions
    - `posts-create` - Create new post (text, images, polls)
    - `posts-get-feed` - Paginated feed with filters
    - `posts-get-by-crew` - Crew-specific posts
    - `posts-update/delete` - Post management
    
12. **4.2** Interaction Edge Functions
    - `posts-like/unlike` - Like toggle
    - `posts-comment` - Add comment to post
    - `posts-share` - Share to other crews
    
13. **4.3** Social Vue Components
    - `FeedView` - Main feed with infinite scroll
    - `PostCard` - Individual post with actions
    - `PostComposer` - Rich text editor for posts
    - `CommentThread` - Nested comments
    - `UserCard` - Crew member mini-profile

## Phase 5: Project Management Module (Week 5)
**Goal**: Tasks, boards, timelines

14. **5.1** Project Edge Functions
    - `projects-create` - New project with team
    - `projects-get` - Single project with stats
    - `projects-list` - User's projects
    - `projects-update/archive`
    
15. **5.2** Task Edge Functions
    - `tasks-create` - Create task with assignee
    - `tasks-get-board` - Kanban board data
    - `tasks-move` - Change status/position
    - `tasks-update` - Edit task details
    - `tasks-comment` - Task comments
    
16. **5.3** Timeline/Milestone Functions
    - `milestones-create` - Project milestones
    - `milestones-update` - Progress tracking
    
17. **5.4** Project Vue Components
    - `ProjectDashboard` - Overview with stats
    - `KanbanBoard` - Drag-drop task board
    - `GanttChart` - Timeline visualization
    - `TaskCard` - Individual task component
    - `MilestoneList` - Project milestones

## Phase 6: Document Suite (Week 6)
**Goal**: Forms, spreadsheets, e-signatures

18. **6.1** Document Edge Functions
    - `docs-create` - New document/spreadsheet
    - `docs-get` - Fetch document content
    - `docs-update` - Auto-save content
    - `docs-list` - User's documents
    - `docs-share` - Share with permissions
    
19. **6.2** Form Builder Functions
    - `forms-create-template` - Form templates
    - `forms-submit` - Form submissions
    - `forms-list-responses` - View submissions
    
20. **6.3** E-Signature Functions
    - `signatures-request` - Send for signing
    - `signatures-sign` - Apply signature
    - `signatures-verify` - Verify document signed
    
21. **6.4** Document Vue Components
    - `DocumentEditor` - Rich text editing
    - `SpreadsheetView` - Grid-based spreadsheet
    - `FormBuilder` - Drag-drop form creator
    - `SignaturePad` - Canvas signature capture
    - `DocViewer` - Read-only document view

## Phase 7: NGO-Specific Features (Week 7)
**Goal**: Structure integration, permissions

22. **7.1** Crew/Region Edge Functions
    - `crews-create` - Create crew/team
    - `crews-get` - Crew details with members
    - `crews-assign` - Add/remove members
    - `regions-list` - All regions
    
23. **7.2** Hierarchy & Permissions
    - `permissions-check` - Role-based access
    - `permissions-grant` - Elevate user role
    - `audit-log` - Track all actions
    
24. **7.3** Dashboard Components
    - `AdminDashboard` - Staff-level overview
    - `RegionalDashboard` - Councilor view
    - `CrewDashboard` - Team leader view
    - `StatsWidgets` - Charts and metrics

## Phase 8: Integration & Deployment (Week 8)
**Goal**: WASM compilation, Tauri build, GitHub Pages

25. **8.1** WASM Module Compilation
    - Compile shared Rust code to WASM
    - Integration with Vue components
    - Performance optimization
    
26. **8.2** Tauri Desktop Build
    - Configure tauri.conf.json
    - Build for Windows/macOS/Linux
    - Test native features (notifications, file system)
    
27. **8.3** GitHub Pages Deployment
    - Configure static site generation
    - Edge function stubs for demo mode
    - WASM asset optimization

---

# 5. TESTING AND VALIDATION

## Functional Tests
- [ ] Auth flow: Register → Login → Logout → Password reset
- [ ] Feed: Create post → Like → Comment → Share
- [ ] Projects: Create → Assign tasks → Move stages → Complete
- [ ] Docs: Create → Edit → Share → Sign → Download

## Role-Based Access Tests
- [ ] Stakeholder cannot create/edit content
- [ ] Partner can only access shared projects
- [ ] Crew Leader can assign tasks within crew
- [ ] Regional Councilor sees cross-crew data

## Cross-Platform Tests
- [ ] Desktop: Windows/Mac/Linux Tauri builds
- [ ] Web: GitHub Pages hosted version
- [ ] Mobile: Responsive layouts on iOS/Android

## Performance Tests
- [ ] WASM module load time < 500ms
- [ ] Feed infinite scroll smooth (60fps)
- [ ] Large document (1000+ rows) renders properly

---

# 6. FILE STRUCTURE

```
earth-guardians-platform/
├── apps/
│   ├── web/                    # Nuxt 3 application
│   │   ├── components/
│   │   │   ├── ui/             # Base UI components
│   │   │   ├── social/         # Social media components
│   │   │   ├── projects/       # Project management
│   │   │   └── docs/           # Document suite
│   │   ├── composables/       # Vue composables
│   │   ├── layouts/           # App layouts
│   │   ├── pages/             # Route pages
│   │   ├── assets/            # Styles, fonts
│   │   └── nuxt.config.ts
│   │
│   └── desktop/               # Tauri application
│       ├── src-tauri/         # Rust backend
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   └── lib.rs
│       │   └── Cargo.toml
│       └── src/               # Desktop-specific Vue
│
├── packages/
│   └── shared/                # WASM shared module
│       ├── src/
│       │   └── lib.rs
│       └── Cargo.toml
│
├── supabase/
│   └── functions/            # Edge functions
│       ├── auth/
│       ├── social/
│       ├── projects/
│       └── docs/
│
└── docs/                    # Documentation
```

---

# 7. COLOR TOKEN SYSTEM (Neo-Brutalist)

```css
/* Light Theme (Default) */
--bg-primary: #FFFFFF;
--bg-secondary: #F5F5F5;
--border-color: #000000;
--text-primary: #000000;
--text-secondary: #333333;

/* Dark Theme */
--bg-primary: #0A0A0A;
--bg-secondary: #1A1A1A;
--border-color: #FFFFFF;
--text-primary: #FFFFFF;
--text-secondary: #CCCCCC;

/* Accent System */
--accent-primary: #000000;
--accent-success: #00FF00;
--accent-warning: #FFFF00;
--accent-error: #FF0000;
--accent-info: #00FFFF;
```

---

# 8. SUCCESS CRITERIA

1. ✅ Full NGO hierarchy with role-based permissions working
2. ✅ Social feed with posts, likes, comments functional
3. ✅ Project management with Kanban + Gantt views
4. ✅ Document suite with forms, sheets, signatures
5. ✅ Theme switcher (Light/Dark/High Contrast) operational
6. ✅ Tauri desktop app builds for all platforms
7. ✅ WASM modules compile and integrate
8. ✅ All Supabase calls go through Edge Functions only
9. ✅ GitHub Pages static deployment works
10. ✅ Cross-device responsive (desktop/tablet/phone)

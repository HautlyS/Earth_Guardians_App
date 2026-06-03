/**
 * Vue Router Configuration
 * Earth Guardians Platform
 */
import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guest?: boolean
    title?: string
  }
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'Earth Guardians' }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { requiresAuth: true, title: 'Projects' }
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { requiresAuth: true, title: 'Project' }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/TasksView.vue'),
    meta: { requiresAuth: true, title: 'Tasks' }
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('../views/DocsView.vue'),
    meta: { requiresAuth: true, title: 'Docs' }
  },
  {
    path: '/email',
    name: 'Email',
    component: () => import('../views/EmailView.vue'),
    meta: { requiresAuth: true, title: 'Email' }
  },
  {
    path: '/p2p',
    name: 'P2P',
    component: () => import('../views/P2PView.vue'),
    meta: { requiresAuth: true, title: 'Peer to Peer' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true, title: 'Settings' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'Profile' }
  },
  {
    path: '/profile/:id',
    name: 'ProfileById',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'Profile' }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('../views/AuthCallbackView.vue'),
    meta: { title: 'Signing you in...' }
  },
  {
    path: '/auth/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true, title: 'Sign in' }
  },
  {
    path: '/auth/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true, title: 'Create account' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: 'Page not found' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 80 }
    return { top: 0 }
  }
})

router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta?.title) {
    document.title = `${to.meta.title} · Earth Guardians`
  }
})

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  const isGuestOnly = to.matched.some((r) => r.meta.guest)

  try {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    if (requiresAuth && !session) {
      const redirectTo = to.fullPath
      next(`/?redirect=${encodeURIComponent(redirectTo)}&login=true`)
      return
    }

    if (isGuestOnly && session) {
      next('/')
      return
    }

    next()
  } catch (error) {
    console.error('Auth check failed:', error)
    next()
  }
})

export default router

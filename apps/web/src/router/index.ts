/**
 * Vue Router Configuration
 * Earth Guardians Platform
 */
import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/TasksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('../views/DocsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/email',
    name: 'Email',
    component: () => import('../views/EmailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/p2p',
    name: 'P2P',
    component: () => import('../views/P2PView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('../views/AuthCallbackView.vue')
  },
  {
    path: '/auth/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/auth/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (requiresAuth && !session) {
      // Store intended destination
      const redirectTo = to.fullPath
      next(`/?redirect=${encodeURIComponent(redirectTo)}&login=true`)
    } else if ((to.path === '/auth/login' || to.path === '/auth/register') && session) {
      // Redirect authenticated users away from auth pages
      next('/')
    } else {
      next()
    }
  } catch (error) {
    console.error('Auth check failed:', error)
    next()
  }
})

export default router
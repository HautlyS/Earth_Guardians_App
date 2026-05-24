export default defineNuxtConfig({
  compatibilityDate: '2024-01-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/supabase', '@nuxtjs/google-fonts'],
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  googleFonts: {
    families: {
      'Space Grotesk': [400, 500, 600, 700],
      'JetBrains Mono': [400, 500, 600],
      Inter: [400, 500, 600, 700],
    },
  },
  app: {
    head: {
      title: 'Earth Guardians',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Earth Guardians NGO Collaborative Platform' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: true,
  },
})

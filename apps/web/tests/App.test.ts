import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('App Component', () => {
  it('renders the app title', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.find('h1').text()).toContain('EARTH GUARDIANS')
  })

  it('has theme switcher buttons', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    const buttons = wrapper.findAll('.theme-switcher button')
    expect(buttons.length).toBe(3)
  })

  it('changes theme when button clicked', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    const darkButton = wrapper.findAll('.theme-switcher button')[1]
    await darkButton.trigger('click')
    
    // Theme change is handled internally
    expect(wrapper.vm.$data.theme).toBe('dark')
  })

  it('has P2P network card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.text()).toContain('P2P NETWORK')
  })

  it('has WASM engine card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.text()).toContain('WASM ENGINE')
  })

  it('has Supabase card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.text()).toContain('SUPABASE')
  })

  it('has performance metrics card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.text()).toContain('PERFORMANCE METRICS')
  })

  it('has quick actions card', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    
    expect(wrapper.text()).toContain('QUICK ACTIONS')
  })
})

describe('P2P Manager', () => {
  it('exports p2pManager', async () => {
    const { p2pManager } = await import('../../../src/p2p/p2p-manager')
    
    expect(p2pManager).toBeDefined()
    expect(typeof p2pManager.getStats).toBe('function')
  })

  it('getStats returns expected structure', async () => {
    const { p2pManager } = await import('../../../src/p2p/p2p-manager')
    
    const stats = p2pManager.getStats()
    
    expect(stats).toHaveProperty('peerId')
    expect(stats).toHaveProperty('connectedPeers')
    expect(stats).toHaveProperty('stunServers')
    expect(typeof stats.peerId).toBe('string')
    expect(typeof stats.connectedPeers).toBe('number')
    expect(typeof stats.stunServers).toBe('number')
  })
})
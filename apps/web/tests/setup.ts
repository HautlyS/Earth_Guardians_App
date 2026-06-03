import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@vue/test-utils'

// Global test setup
beforeAll(() => {
  // Set up test environment
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  } as any
  
  global.sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  } as any
})

afterEach(() => {
  cleanup()
})

afterAll(() => {
  cleanup()
})

// Mock WebRTC
class MockRTCPeerConnection {
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' })
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' })
  setLocalDescription = vi.fn().mockResolvedValue(undefined)
  setRemoteDescription = vi.fn().mockResolvedValue(undefined)
  addIceCandidate = vi.fn().mockResolvedValue(undefined)
  createDataChannel = vi.fn().mockReturnValue({
    send: vi.fn(),
    close: vi.fn(),
    onmessage: null,
    onopen: null,
    onclose: null
  })
  close = vi.fn()
  onicecandidate = null
  ondatachannel = null
  ontrack = null
}

global.RTCPeerConnection = MockRTCPeerConnection as any

// Mock WebSocket
class MockWebSocket {
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  readyState = 1
  send = vi.fn()
  close = vi.fn()
}

global.WebSocket = MockWebSocket as any

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({})
}) as any
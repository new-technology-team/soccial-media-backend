import { create } from 'zustand'

export type IncomingCallState = {
  fromUserId: number
  conversationId: string | null
  callType: 'voice' | 'video'
  offer: RTCSessionDescriptionInit
}

type CallStoreState = {
  incomingCall: IncomingCallState | null
  setIncomingCall: (call: IncomingCallState | null) => void
}

export const useCallStore = create<CallStoreState>((set) => ({
  incomingCall: null,
  setIncomingCall: (call) => set({ incomingCall: call }),
}))

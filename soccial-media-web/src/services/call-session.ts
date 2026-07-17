// Module-level WebRTC refs — survive React component lifecycle (persist across navigation)
export const callSession = {
  peers: new Map<number, RTCPeerConnection>(),
  pendingCandidates: new Map<number, RTCIceCandidateInit[]>(),
  localStream: null as MediaStream | null,
}

export const stopMediaStreamTracks = (stream: MediaStream | null | undefined) => {
  stream?.getTracks().forEach((track) => track.stop())
}

export const resetCallSession = () => {
  callSession.peers.forEach((peer) => peer.close())
  callSession.peers.clear()
  callSession.pendingCandidates.clear()
  stopMediaStreamTracks(callSession.localStream)
  callSession.localStream = null
}

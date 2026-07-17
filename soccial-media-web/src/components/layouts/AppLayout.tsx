import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/contexts/auth-store'
import { useCallStore } from '@/contexts/call-store'
import { useChatStore } from '@/contexts/chat-store'
import { callSession, resetCallSession } from '@/services/call-session'
import { ActiveCallWindow, IncomingCallModal, MinimizedCallPill, OutgoingCallModal, RemoteAudioSink, isTerminalErrorState } from '@/components/call'
import { resolveApiAssetUrl } from '@/api/client'
import { connectSocket, getSocket } from '@/services/socket'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'
import styles from './app-layout.module.css'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const incomingCall = useCallStore((state) => state.incomingCall)
  const setAcceptPending = useCallStore((state) => state.setAcceptPending)
  const updateUserAvatar = useChatStore((state) => state.updateUserAvatar)

  // Active call state from Zustand
  const activeCall = useCallStore((s) => s.activeCall)
  const callState = useCallStore((s) => s.callState)
  const callAnswered = useCallStore((s) => s.callAnswered)
  const callMinimized = useCallStore((s) => s.callMinimized)
  const mutedMic = useCallStore((s) => s.mutedMic)
  const mutedCam = useCallStore((s) => s.mutedCam)
  const callSeconds = useCallStore((s) => s.callSeconds)
  const cameraAvailable = useCallStore((s) => s.cameraAvailable)
  const callParticipants = useCallStore((s) => s.callParticipants)
  const localStream = useCallStore((s) => s.localStream)
  const remoteStreams = useCallStore((s) => s.remoteStreams)
  const micDenied = useCallStore((s) => s.micDenied)
  const screenSharing = useCallStore((s) => s.screenSharing)
  const connectionQuality = useCallStore((s) => s.connectionQuality)
  const callErrorMessage = useCallStore((s) => s.callErrorMessage)
  const addMembersAction = useCallStore((s) => s.addMembersAction)
  const retryCallAction = useCallStore((s) => s.retryCallAction)

  const [mutedSpeaker, setMutedSpeaker] = useState(false)
  const isEndingCallRef = useRef(false)

  const formattedCallTime = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`

  // Call timer — runs in AppLayout so it persists across navigation
  useEffect(() => {
    if (!callAnswered || !activeCall) return
    const { setCallSeconds } = useCallStore.getState()
    setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    const id = window.setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [callAnswered, activeCall?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !user?.id) return

    const socket = connectSocket(token, user.id)

    const onOffer = (payload: any) => {
      const hasSdp = Boolean(payload?.offer?.sdp)
      // Chấp nhận cả offer WebRTC (web) lẫn offer Jitsi từ mobile (chỉ có roomId).
      if (!hasSdp && !payload?.roomId) return
      const conversationId = payload.conversationId ? String(payload.conversationId) : null
      const { activeCall: currentCall, callAnswered: answered, setIncomingCall } = useCallStore.getState()
      if (answered && currentCall?.conversationId && conversationId === currentCall.conversationId) return
      setIncomingCall({
        fromUserId: Number(payload.fromUserId || 0),
        conversationId,
        callType: payload.callType === 'video' ? 'video' : 'voice',
        offer: hasSdp ? payload.offer : undefined,
        roomId: payload?.roomId ? String(payload.roomId) : undefined,
        useJitsi: !hasSdp && Boolean(payload?.roomId),
        fromUserName: payload?.fromUserName || undefined,
        conversationName: payload?.conversationName || undefined,
      })
    }

    const onEnd = (payload?: { fromUserId?: number | string }) => {
      if (Number(payload?.fromUserId || 0) === Number(user.id || 0)) return
      const {
        setIncomingCall, setActiveCall, setCallState, setCallAnswered, setCallMinimized,
        setCallSeconds, setCallParticipants, setLocalStream, setRemoteStreams,
        setMutedMic, setMutedCam, setScreenSharing, setConnectionQuality,
      } = useCallStore.getState()
      setIncomingCall(null)
      resetCallSession()
      setLocalStream(null)
      setRemoteStreams([])
      setActiveCall(null)
      setCallState('ended')
      setCallAnswered(false)
      setCallMinimized(false)
      setCallSeconds(0)
      setCallParticipants([])
      setMutedMic(false)
      setMutedCam(false)
      setScreenSharing(false)
      setConnectionQuality('unknown')
      setMutedSpeaker(false)
      isEndingCallRef.current = false
    }

    const onAuthRevoked = (payload: { reason?: string }) => {
      clearAuth()
      socket.disconnect()
      toast({
        title: 'Phiên đăng nhập đã bị thu hồi',
        description: payload?.reason ? `Lý do: ${payload.reason}` : 'Vui lòng đăng nhập lại để tiếp tục.',
        variant: 'destructive',
      })
      navigate('/auth/login?reason=session-expired', { replace: true })
    }

    const onAvatarUpdated = (payload: { userId?: number; avatarUrl?: string; user?: User }) => {
      if (!payload?.userId) return
      const nextAvatar = resolveApiAssetUrl(payload.avatarUrl) ?? payload.avatarUrl ?? null
      updateUserAvatar(Number(payload.userId), nextAvatar || null)
      if (Number(payload.userId) !== Number(user.id) || !refreshToken) return
      setAuth({
        accessToken: token,
        refreshToken,
        user: {
          ...user,
          ...(payload.user || {}),
          avatarUrl: nextAvatar || payload.user?.avatarUrl || user.avatarUrl,
        },
      })
    }

    const onUserUpdated = (payload: { userId?: number | string; user?: User; action?: string }) => {
      if (!payload?.user || Number(payload.userId || payload.user.id) !== Number(user.id) || !refreshToken) return
      setAuth({
        accessToken: token,
        refreshToken,
        user: {
          ...user,
          ...payload.user,
        },
      })
      if (payload.action && !['updated'].includes(payload.action)) {
        toast({
          title: 'Tài khoản đã được cập nhật',
          description: 'Trạng thái tài khoản của bạn vừa được đồng bộ từ hệ thống kiểm duyệt.',
        })
      }
    }

    socket.on('call:offer', onOffer)
    socket.on('call:incoming', onOffer)
    socket.on('call:ended', onEnd)
    socket.on('auth:revoked', onAuthRevoked)
    socket.on('user:avatar-updated', onAvatarUpdated)
    socket.on('user:updated', onUserUpdated)
    socket.on('user:moderation-updated', onUserUpdated)

    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:incoming', onOffer)
      socket.off('call:ended', onEnd)
      socket.off('auth:revoked', onAuthRevoked)
      socket.off('user:avatar-updated', onAvatarUpdated)
      socket.off('user:updated', onUserUpdated)
      socket.off('user:moderation-updated', onUserUpdated)
    }
  }, [clearAuth, navigate, refreshToken, setAuth, token, updateUserAvatar, user])

  const handleOpenCall = () => {
    setAcceptPending(true)
    const target = incomingCall?.conversationId
      ? `/messages?conversation=${encodeURIComponent(incomingCall.conversationId)}`
      : '/messages'
    navigate(target)
  }

  const handleDeclineCall = () => {
    const socket = getSocket()
    if (socket && incomingCall?.conversationId && incomingCall?.fromUserId) {
      socket.emit('call:reject', {
        targetUserId: incomingCall.fromUserId,
        conversationId: incomingCall.conversationId,
        reason: 'declined',
      })
    }
    const { setIncomingCall } = useCallStore.getState()
    setIncomingCall(null)
  }

  // Call control handlers for AppLayout (used when navigated away from /messages)
  const handleToggleMicGlobal = () => {
    const { mutedMic: current, setMutedMic } = useCallStore.getState()
    const next = !current
    useCallStore.getState().localStream?.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMutedMic(next)
    getSocket()?.emit('participant_muted', { conversationId: activeCall?.conversationId, micMuted: next })
  }

  const handleToggleCameraGlobal = async () => {
    const { mutedCam: current, setMutedCam, cameraAvailable: available } = useCallStore.getState()
    if (!available || activeCall?.type === 'voice') return
    const next = !current
    let stream = useCallStore.getState().localStream
    if (!stream) return

    if (next) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false
        stream?.removeTrack(track)
        track.stop()
      })
      callSession.peers.forEach((pc) => {
        pc.getSenders()
          .filter((sender) => sender.track?.kind === 'video')
          .forEach((sender) => sender.replaceTrack(null).catch(() => undefined))
      })
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const [videoTrack] = videoStream.getVideoTracks()
        if (!videoTrack) return
        stream.addTrack(videoTrack)
        callSession.peers.forEach((pc) => {
          const sender = pc.getSenders().find((item) => item.track?.kind === 'video')
          if (sender) sender.replaceTrack(videoTrack).catch(() => undefined)
          else pc.addTrack(videoTrack, stream!)
        })
      } catch {
        toast({ title: 'Không thể bật camera', variant: 'destructive' })
        return
      }
    }

    useCallStore.getState().setLocalStream(new MediaStream(stream.getTracks()))
    callSession.localStream = stream
    setMutedCam(next)
    getSocket()?.emit(next ? 'participant_camera_off' : 'participant_camera_on', { conversationId: activeCall?.conversationId })
    getSocket()?.emit('participant_updated', { conversationId: activeCall?.conversationId, cameraOff: next })
    const socket = getSocket()
    if (socket && activeCall?.conversationId) {
      callSession.peers.forEach((pc, targetUserId) => {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            socket.emit('call:offer', {
              targetUserId,
              conversationId: activeCall.conversationId,
              callType: activeCall.type,
              offer: { type: offer.type, sdp: offer.sdp },
              renegotiate: true,
            })
          })
          .catch(() => undefined)
      })
    }
  }

  const handleEndCallGlobal = () => {
    if (isEndingCallRef.current) return
    isEndingCallRef.current = true
    const socket = getSocket()
    const conversationId = activeCall?.conversationId
    if (socket && conversationId) {
      if (activeCall?.mode === 'group') {
        socket.emit('group_call_left', { conversationId, callType: activeCall.type })
      } else {
        socket.emit('call:end', { conversationId, callType: activeCall?.type, mode: activeCall?.mode })
      }
    }
    resetCallSession()
    const {
      setActiveCall, setCallState, setCallAnswered, setCallMinimized,
      setCallSeconds, setCallParticipants, setLocalStream, setRemoteStreams,
      setMutedMic, setMutedCam,
    } = useCallStore.getState()
    setLocalStream(null)
    setRemoteStreams([])
    setActiveCall(null)
    setCallState('idle')
    setCallAnswered(false)
    setCallMinimized(false)
    setCallSeconds(0)
    setCallParticipants([])
    setMutedMic(false)
    setMutedCam(false)
    setMutedSpeaker(false)
    callSession.localStream = null
    window.setTimeout(() => {
      isEndingCallRef.current = false
    }, 500)
  }

  // Chia sẻ màn hình: thay video track của mọi peer bằng luồng màn hình (tự chứa, dùng callSession).
  const handleToggleScreenShare = async () => {
    const store = useCallStore.getState()
    if (store.screenSharing) {
      const camTrack = callSession.localStream?.getVideoTracks()[0] || null
      callSession.peers.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender && camTrack) sender.replaceTrack(camTrack).catch(() => undefined)
      })
      store.setScreenSharing(false)
      return
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = display.getVideoTracks()[0]
      if (!screenTrack) return
      callSession.peers.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(screenTrack).catch(() => undefined)
      })
      screenTrack.onended = () => {
        const camTrack = callSession.localStream?.getVideoTracks()[0] || null
        callSession.peers.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
          if (sender && camTrack) sender.replaceTrack(camTrack).catch(() => undefined)
        })
        useCallStore.getState().setScreenSharing(false)
      }
      store.setScreenSharing(true)
    } catch {
      // người dùng hủy chọn màn hình
    }
  }

  const handleCloseCallError = () => {
    const {
      setActiveCall, setCallState, setCallAnswered, setCallMinimized,
      setCallSeconds, setCallParticipants, setCallErrorMessage,
    } = useCallStore.getState()
    setActiveCall(null)
    setCallState('idle')
    setCallAnswered(false)
    setCallMinimized(false)
    setCallSeconds(0)
    setCallParticipants([])
    setCallErrorMessage(null)
  }

  // Giám sát chất lượng kết nối qua RTCStats (RTT) khi đang trong cuộc gọi.
  useEffect(() => {
    if (!activeCall || !callAnswered) {
      useCallStore.getState().setConnectionQuality('unknown')
      return
    }
    const id = window.setInterval(async () => {
      const peers = Array.from(callSession.peers.values())
      if (!peers.length) return
      let worstRtt = 0
      let sawRtt = false
      for (const pc of peers) {
        try {
          const stats = await pc.getStats()
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && (report as any).state === 'succeeded' && typeof (report as any).currentRoundTripTime === 'number') {
              sawRtt = true
              worstRtt = Math.max(worstRtt, (report as any).currentRoundTripTime)
            }
          })
        } catch {
          // bỏ qua
        }
      }
      const quality = !sawRtt ? 'unknown' : worstRtt < 0.2 ? 'good' : worstRtt < 0.45 ? 'fair' : 'poor'
      useCallStore.getState().setConnectionQuality(quality)
    }, 3000)
    return () => window.clearInterval(id)
  }, [activeCall, callAnswered])

  // Messages renders the active call inside its chat panel; other pages use the minimized pill.
  const onMessagesPage = pathname.startsWith('/messages')
  const shouldDockActiveCall = Boolean(activeCall && callAnswered && (callMinimized || !onMessagesPage))

  const isCallError = isTerminalErrorState(callState)

  return (
    <div className={styles.page}>
      <main className={styles.main}>{children}</main>

      {/* Phát âm thanh người tham gia từ xa — luôn render khi có cuộc gọi để nghe được cả khi thu nhỏ. */}
      {activeCall && callAnswered ? (
        <RemoteAudioSink remoteStreams={remoteStreams} mutedSpeaker={mutedSpeaker} />
      ) : null}

      {/* Incoming call modal — shown outside /messages only (messages page has its own) */}
      {incomingCall && !onMessagesPage ? (
        <IncomingCallModal
          name={
            incomingCall.conversationName ||
            incomingCall.fromUserName ||
            `Người dùng #${incomingCall.fromUserId}`
          }
          callType={incomingCall.callType}
          state="incoming"
          onAccept={handleOpenCall}
          onDecline={handleDeclineCall}
        />
      ) : null}

      {/* OutgoingCallModal — persists across navigation (cũng hiển thị trạng thái lỗi/cuối) */}
      {activeCall && !callAnswered && !callMinimized ? (
        <OutgoingCallModal
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          callType={activeCall.type}
          mode={activeCall.mode}
          state={callState === 'idle' ? 'calling' : callState}
          timer={formattedCallTime}
          errorMessage={callErrorMessage || undefined}
          onEnd={handleEndCallGlobal}
          onRetry={isCallError && retryCallAction ? retryCallAction : undefined}
          onClose={handleCloseCallError}
        />
      ) : null}

      {/* ActiveCallWindow is owned by MessagesPage while inside the messages workspace. */}
      {activeCall && callAnswered && !shouldDockActiveCall && !onMessagesPage ? (
        <ActiveCallWindow
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          callType={activeCall.type}
          mode={activeCall.mode}
          state={callState === 'idle' ? 'connected' : callState}
          duration={formattedCallTime}
          participants={callParticipants}
          localStream={localStream}
          remoteStreams={remoteStreams}
          mutedMic={mutedMic}
          mutedCam={mutedCam}
          mutedSpeaker={mutedSpeaker}
          cameraAvailable={cameraAvailable}
          micDenied={micDenied}
          screenSharing={screenSharing}
          connectionQuality={connectionQuality}
          onToggleMic={handleToggleMicGlobal}
          onToggleCamera={handleToggleCameraGlobal}
          onToggleSpeaker={() => setMutedSpeaker((v) => !v)}
          onToggleScreenShare={handleToggleScreenShare}
          onAddMembers={activeCall.mode === 'group' && addMembersAction ? addMembersAction : undefined}
          onMinimize={() => useCallStore.getState().setCallMinimized(true)}
          onEnd={handleEndCallGlobal}
        />
      ) : null}

      {/* Minimized call pill — persists across navigation */}
      {activeCall && (callMinimized || (callAnswered && !onMessagesPage)) ? (
        <MinimizedCallPill
          name={activeCall.withName}
          avatarUrl={activeCall.avatarUrl}
          duration={formattedCallTime}
          participantCount={
            activeCall.mode === 'group'
              ? callParticipants.filter((p) => p.status === 'joined').length || undefined
              : undefined
          }
          onOpen={() => {
            const target = activeCall.conversationId
              ? `/messages?conversation=${encodeURIComponent(activeCall.conversationId)}`
              : '/messages'
            if (!onMessagesPage) navigate(target)
            useCallStore.getState().setCallMinimized(false)
          }}
          onEnd={handleEndCallGlobal}
        />
      ) : null}
    </div>
  )
}

import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2, VolumeX, Minimize2, MonitorUp, MonitorOff, UserPlus, Users, LockKeyhole, AlertTriangle, RotateCcw, X, Signal, SignalLow, SignalZero } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/utils'
import styles from './call-ui.module.css'

export type CallKind = 'voice' | 'video'
export type CallMode = 'private' | 'group'
export type CallState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'cancelled'
  | 'no_answer'
  | 'failed'

export type CallParticipantStatus = 'joined' | 'ringing' | 'no_answer' | 'rejected'

export type CallParticipant = {
  userId: number
  name: string
  avatarUrl?: string | null
  role?: string | null
  status?: CallParticipantStatus
  micMuted?: boolean
  cameraOff?: boolean
  speaking?: boolean
  stream?: MediaStream | null
  isLocal?: boolean
}

export type CallSettings = {
  sound: boolean
  vibration: boolean
  floatingWindow: boolean
  autoTimeout: boolean
  allowVoice: boolean
  allowVideo: boolean
  allowGroup: boolean
  ringGroup: boolean
  missedNotifications: boolean
  showSpeaker: boolean
  autoMuteOnJoin: boolean
  autoCameraOffOnJoin: boolean
  blockStrangers: boolean
}

export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown'

export const TERMINAL_ERROR_STATES: CallState[] = ['failed', 'no_answer', 'rejected', 'cancelled', 'missed']

export function isTerminalErrorState(state: CallState) {
  return TERMINAL_ERROR_STATES.includes(state)
}

export const CALL_STATE_LABELS: Record<CallState, string> = {
  idle: 'Sẵn sàng',
  calling: 'Đang gọi...',
  ringing: 'Đang đổ chuông',
  incoming: 'Cuộc gọi đến',
  connecting: 'Đang kết nối...',
  connected: 'Đã kết nối',
  ended: 'Cuộc gọi đã kết thúc',
  missed: 'Cuộc gọi nhỡ',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy cuộc gọi',
  no_answer: 'Không có phản hồi',
  failed: 'Cuộc gọi thất bại',
}

function Avatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string | null; className?: string }) {
  return (
    <div className={cn(styles.avatar, className)}>
      {avatarUrl ? <img src={avatarUrl} alt={name} /> : (name[0] || 'Z').toUpperCase()}
    </div>
  )
}

function AudioWave() {
  return (
    <div className={styles.pulse} aria-hidden="true">
      <i /><i /><i /><i /><i />
    </div>
  )
}

function StreamVideo({ stream, muted, className }: { stream?: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const hasVideo = Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled))

  useEffect(() => {
    if (ref.current && stream && hasVideo) {
      ref.current.srcObject = stream
      ref.current.play().catch(() => undefined)
    }
  }, [stream, hasVideo])

  if (!stream || !hasVideo) return null
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />
}

function RemoteAudioTrack({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay playsInline muted={muted} />
}

/**
 * Phát âm thanh của tất cả người tham gia từ xa. Tách riêng khỏi phần hiển thị video để
 * cuộc gọi thoại (không có video) vẫn nghe được và âm thanh không bị mất khi thu nhỏ cửa sổ.
 */
export function RemoteAudioSink({ remoteStreams, mutedSpeaker }: { remoteStreams?: Array<{ userId: number; stream: MediaStream }>; mutedSpeaker?: boolean }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      {(remoteStreams || []).map((item) => (
        <RemoteAudioTrack key={item.userId} stream={item.stream} muted={mutedSpeaker} />
      ))}
    </div>
  )
}

export function ConnectionIndicator({ quality }: { quality?: ConnectionQuality }) {
  if (!quality || quality === 'unknown') return null
  const map: Record<Exclude<ConnectionQuality, 'unknown'>, { icon: typeof Signal; label: string; cls: string }> = {
    good: { icon: Signal, label: 'Kết nối tốt', cls: styles.qualityGood },
    fair: { icon: SignalLow, label: 'Kết nối trung bình', cls: styles.qualityFair },
    poor: { icon: SignalZero, label: 'Kết nối yếu', cls: styles.qualityPoor },
  }
  const { icon: Icon, label, cls } = map[quality]
  return (
    <span className={cn(styles.quality, cls)} title={label} aria-label={label}>
      <Icon size={16} />
    </span>
  )
}

type ModalProps = {
  name: string
  avatarUrl?: string | null
  callType: CallKind
  mode?: CallMode
  state?: CallState
  timer?: string
  callerName?: string
  errorMessage?: string
  countdownSeconds?: number
  onAccept?: () => void
  onAcceptAudioOnly?: () => void
  onDecline?: () => void
  onEnd?: () => void
  onRetry?: () => void
  onClose?: () => void
}

export function IncomingCallModal({ name, avatarUrl, callType, mode = 'private', callerName, countdownSeconds, onAccept, onAcceptAudioOnly, onDecline }: ModalProps) {
  const group = mode === 'group'
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={group ? 'Cuộc gọi nhóm đến' : 'Cuộc gọi đến'}>
      <section className={styles.modal}>
        <Avatar name={name} avatarUrl={avatarUrl} className={styles.avatarRinging} />
        <p className={styles.eyebrow}>{group ? 'Cuộc gọi nhóm đến' : 'Cuộc gọi đến'}</p>
        <h2 className={styles.name}>{name}</h2>
        {callerName ? <p className={styles.status}>{callerName} đang gọi</p> : null}
        <p className={styles.status}>{group ? (callType === 'video' ? 'Cuộc gọi video nhóm' : 'Cuộc gọi thoại nhóm') : callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}</p>
        {typeof countdownSeconds === 'number' && countdownSeconds > 0 ? (
          <p className={styles.countdown}>Tự động kết thúc sau {countdownSeconds}s</p>
        ) : null}
        <AudioWave />
        <div className={styles.actions}>
          <button type="button" className={cn(styles.button, styles.danger)} onClick={onDecline}>
            <PhoneOff size={18} /> Từ chối
          </button>
          {callType === 'video' && onAcceptAudioOnly ? (
            <button type="button" className={cn(styles.button, styles.neutral)} onClick={onAcceptAudioOnly} title="Trả lời không bật camera">
              <Phone size={18} /> Trả lời (thoại)
            </button>
          ) : null}
          <button type="button" className={cn(styles.button, styles.accept)} onClick={() => onAccept?.()}>
            {callType === 'video' && !group ? <Video size={18} /> : <Phone size={18} />} {group ? 'Tham gia' : 'Trả lời'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function OutgoingCallModal({ name, avatarUrl, callType, mode = 'private', state, timer, errorMessage, onEnd, onRetry, onClose }: ModalProps) {
  const group = mode === 'group'
  const currentState = state || 'calling'
  const isError = isTerminalErrorState(currentState)
  const label = isError
    ? errorMessage || CALL_STATE_LABELS[currentState]
    : group && currentState === 'calling'
      ? 'Đang gọi nhóm...'
      : CALL_STATE_LABELS[currentState]
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={group ? 'Đang gọi nhóm' : 'Đang gọi'}>
      <section className={cn(styles.modal, isError && styles.modalError)}>
        {isError ? (
          <div className={styles.errorBadge}><AlertTriangle size={30} /></div>
        ) : (
          <Avatar name={name} avatarUrl={avatarUrl} />
        )}
        <p className={styles.eyebrow}>{group ? (callType === 'video' ? 'Cuộc gọi video nhóm' : 'Cuộc gọi thoại nhóm') : callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}</p>
        <h2 className={styles.name}>{name}</h2>
        <p className={styles.status}>{label}</p>
        {timer && !isError ? <p className={styles.timer}>{timer}</p> : null}
        {!isError ? <AudioWave /> : null}
        <div className={styles.actions}>
          {isError ? (
            <>
              {onRetry ? (
                <button type="button" className={cn(styles.button, styles.accept)} onClick={onRetry}>
                  <RotateCcw size={18} /> Gọi lại
                </button>
              ) : null}
              <button type="button" className={cn(styles.button, styles.neutral)} onClick={onClose || onEnd}>
                <X size={18} /> Đóng
              </button>
            </>
          ) : (
            <button type="button" className={cn(styles.button, styles.danger)} onClick={onEnd}>
              <PhoneOff size={18} /> Kết thúc
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

type ControlsProps = {
  callType: CallKind
  mutedMic: boolean
  mutedCam: boolean
  mutedSpeaker?: boolean
  cameraAvailable?: boolean
  micDenied?: boolean
  screenSharing?: boolean
  mode?: CallMode
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleSpeaker?: () => void
  onToggleScreenShare?: () => void
  onAddMembers?: () => void
  onMinimize: () => void
  onEnd: () => void
  onShowParticipants?: () => void
}

export function CallControls({ callType, mutedMic, mutedCam, mutedSpeaker = false, cameraAvailable = true, micDenied = false, screenSharing = false, mode = 'private', onToggleMic, onToggleCamera, onToggleSpeaker, onToggleScreenShare, onAddMembers, onMinimize, onEnd, onShowParticipants }: ControlsProps) {
  const supportsScreenShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  return (
    <div className={styles.controls}>
      <button type="button" className={cn(styles.controlButton, mutedMic && styles.controlButtonActive)} onClick={onToggleMic} disabled={micDenied} title={micDenied ? 'Không có quyền micro' : undefined}>
        {mutedMic ? <MicOff size={20} /> : <Mic size={20} />}
        <small>{mutedMic ? 'Bật mic' : 'Tắt mic'}</small>
      </button>
      <button type="button" className={cn(styles.controlButton, mutedCam && styles.controlButtonActive)} onClick={onToggleCamera} disabled={callType === 'voice' || !cameraAvailable}>
        {mutedCam || callType === 'voice' || !cameraAvailable ? <VideoOff size={20} /> : <Video size={20} />}
        <small>{mutedCam ? 'Bật camera' : 'Tắt camera'}</small>
      </button>
      <button type="button" className={cn(styles.controlButton, mutedSpeaker && styles.controlButtonActive)} onClick={onToggleSpeaker}>
        {mutedSpeaker ? <VolumeX size={20} /> : <Volume2 size={20} />}
        <small>{mutedSpeaker ? 'Bật loa' : 'Tắt loa'}</small>
      </button>
      {callType === 'video' && supportsScreenShare && onToggleScreenShare ? (
        <button type="button" className={cn(styles.controlButton, screenSharing && styles.controlButtonActive)} onClick={onToggleScreenShare}>
          {screenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
          <small>{screenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</small>
        </button>
      ) : null}
      {mode === 'group' ? (
        <>
          <button type="button" className={styles.controlButton} onClick={onAddMembers} disabled={!onAddMembers}>
            <UserPlus size={20} />
            <small>Mời thêm</small>
          </button>
          <button type="button" className={styles.controlButton} onClick={onShowParticipants}>
            <Users size={20} />
            <small>Xem thành viên</small>
          </button>
        </>
      ) : null}
      <button type="button" className={styles.controlButton} onClick={onMinimize}>
        <Minimize2 size={20} />
        <small>Thu nhỏ</small>
      </button>
      <button type="button" className={cn(styles.controlButton, styles.controlDanger)} onClick={onEnd}>
        <PhoneOff size={20} />
        <small>{mode === 'group' ? 'Rời cuộc gọi' : 'Kết thúc'}</small>
      </button>
    </div>
  )
}

type ActiveProps = {
  name: string
  avatarUrl?: string | null
  callType: CallKind
  mode?: CallMode
  state: CallState
  duration: string
  participants: CallParticipant[]
  localStream?: MediaStream | null
  remoteStreams?: Array<{ userId: number; stream: MediaStream }>
  mutedMic: boolean
  mutedCam: boolean
  mutedSpeaker?: boolean
  cameraAvailable?: boolean
  micDenied?: boolean
  screenSharing?: boolean
  connectionQuality?: ConnectionQuality
  statusText?: string
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleSpeaker?: () => void
  onToggleScreenShare?: () => void
  onAddMembers?: () => void
  onMinimize: () => void
  onEnd: () => void
  embedded?: boolean
}

export function ActiveCallWindow(props: ActiveProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mode = props.mode || 'private'
  const remote = props.remoteStreams?.[0]?.stream || null
  const remoteHasVideo = Boolean(remote?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled))
  const reconnecting = props.state === 'connecting'
  return (
    <section className={cn(styles.activeWindow, props.embedded && styles.activeWindowEmbedded)} aria-label={mode === 'group' ? 'Cuộc gọi nhóm đang diễn ra' : 'Cuộc gọi đang diễn ra'}>
      <header className={styles.topBar}>
        <div className={styles.topTitle}>
          <Avatar name={props.name} avatarUrl={props.avatarUrl} className={styles.miniAvatar} />
          <div>
            <h2>{props.name}</h2>
            <p>{props.statusText || CALL_STATE_LABELS[props.state]} • {props.duration}</p>
          </div>
        </div>
        <div className={styles.topMeta}>
          <ConnectionIndicator quality={props.connectionQuality} />
          <p className={styles.timer}>{mode === 'group' ? `${props.participants.filter((item) => item.status === 'joined').length || props.participants.length} người tham gia` : props.callType === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}</p>
        </div>
      </header>

      {reconnecting ? <div className={styles.reconnectBanner}>Đang kết nối lại...</div> : null}
      {props.micDenied ? (
        <div className={styles.permissionBanner}>
          <AlertTriangle size={16} /> Trình duyệt chưa cấp quyền micro. Hãy cho phép truy cập để người khác nghe được bạn.
        </div>
      ) : null}

      <main className={styles.stage}>
        {mode === 'group' ? (
          <GroupCallGrid participants={props.participants} />
        ) : props.callType === 'video' ? (
          <div className={styles.videoStage}>
            {remote && remoteHasVideo ? <StreamVideo stream={remote} muted className={styles.remoteVideo} /> : <div className={styles.voiceStage}><Avatar name={props.name} avatarUrl={props.avatarUrl} /><AudioWave /></div>}
            <div className={styles.localPreview}>
              {props.mutedCam ? <Avatar name="Bạn" className={styles.miniAvatar} /> : <StreamVideo stream={props.localStream} muted className={styles.localVideo} />}
            </div>
          </div>
        ) : (
          <div className={styles.voiceStage}>
            <Avatar name={props.name} avatarUrl={props.avatarUrl} />
            <AudioWave />
            <p>{props.mutedMic ? 'Mic của bạn đang tắt' : 'Âm thanh đang hoạt động'}</p>
          </div>
        )}
      </main>

      {drawerOpen ? <GroupParticipantDrawer participants={props.participants} /> : null}
      <CallControls
        callType={props.callType}
        mode={mode}
        mutedMic={props.mutedMic}
        mutedCam={props.mutedCam}
        mutedSpeaker={props.mutedSpeaker}
        cameraAvailable={props.cameraAvailable}
        micDenied={props.micDenied}
        screenSharing={props.screenSharing}
        onToggleMic={props.onToggleMic}
        onToggleCamera={props.onToggleCamera}
        onToggleSpeaker={props.onToggleSpeaker}
        onToggleScreenShare={props.onToggleScreenShare}
        onAddMembers={props.onAddMembers}
        onMinimize={props.onMinimize}
        onEnd={props.onEnd}
        onShowParticipants={() => setDrawerOpen((value) => !value)}
      />
    </section>
  )
}

export function GroupCallGrid({ participants }: { participants: CallParticipant[] }) {
  return (
    <div className={styles.grid}>
      {participants.map((participant) => (
        <GroupParticipantTile key={participant.userId} participant={participant} />
      ))}
    </div>
  )
}

export function GroupParticipantTile({ participant }: { participant: CallParticipant }) {
  const showVideo = Boolean(participant.stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled)) && !participant.cameraOff
  const ringing = participant.status === 'ringing'
  return (
    <article className={cn(styles.tile, participant.speaking && styles.tileSpeaking, ringing && styles.tileRinging)}>
      {/* Video luôn tắt tiếng tại đây — âm thanh phát qua RemoteAudioSink để không nhân đôi/không mất khi thu nhỏ. */}
      {showVideo ? <StreamVideo stream={participant.stream} muted className={styles.remoteVideo} /> : <Avatar name={participant.name} avatarUrl={participant.avatarUrl} className={styles.tileAvatar} />}
      {ringing ? <span className={styles.tileRingingTag}>Đang đổ chuông…</span> : null}
      <div className={styles.tileMeta}>
        <span>{participant.name}{participant.isLocal ? ' (Bạn)' : ''}</span>
        <div className={styles.tileBadges}>
          <span className={cn(styles.badge, participant.micMuted && styles.badgeMuted)}>{participant.micMuted ? <MicOff size={15} /> : <Mic size={15} />}</span>
          <span className={cn(styles.badge, participant.cameraOff && styles.badgeMuted)}>{participant.cameraOff ? <VideoOff size={15} /> : <Video size={15} />}</span>
        </div>
      </div>
    </article>
  )
}

export function GroupParticipantDrawer({ participants }: { participants: CallParticipant[] }) {
  const sections: Array<{ title: string; status: CallParticipantStatus }> = [
    { title: 'Đang tham gia', status: 'joined' },
    { title: 'Đang đổ chuông', status: 'ringing' },
    { title: 'Không phản hồi', status: 'no_answer' },
    { title: 'Đã từ chối', status: 'rejected' },
  ]
  return (
    <aside className={styles.drawer}>
      <h3>Thành viên cuộc gọi</h3>
      {sections.map((section) => {
        const items = participants.filter((item) => (item.status || 'joined') === section.status)
        return (
          <section key={section.status} className={styles.drawerSection}>
            <h4>{section.title}</h4>
            {items.length ? items.map((item) => (
              <div key={item.userId} className={styles.participantRow}>
                <Avatar name={item.name} avatarUrl={item.avatarUrl} className={styles.miniAvatar} />
                <div>
                  <span>{item.name}</span>
                  <small>{item.role || 'Thành viên'}</small>
                </div>
              </div>
            )) : <small>Chưa có thành viên</small>}
          </section>
        )
      })}
    </aside>
  )
}

export function MinimizedCallPill({ name, avatarUrl, duration, participantCount, onOpen, onEnd }: { name: string; avatarUrl?: string | null; duration: string; participantCount?: number; onOpen: () => void; onEnd: () => void }) {
  return (
    <button type="button" className={styles.mini} onClick={onOpen}>
      <Avatar name={name} avatarUrl={avatarUrl} className={styles.miniAvatar} />
      <span className={styles.miniText}>
        <b>{name}</b>
        <span>{participantCount ? `${participantCount} người • ${duration}` : duration}</span>
      </span>
      <span
        className={cn(styles.button, styles.danger)}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          onEnd()
        }}
      >
        <PhoneOff size={16} />
      </span>
    </button>
  )
}

export function CallHistoryMessage({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <p className={styles.history}>
      <Phone size={16} /> {text}
      {actionLabel && onAction ? (
        <button type="button" className={styles.historyAction} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </p>
  )
}

export function CallSettingsPanel({ settings, onChange }: { settings: CallSettings; onChange: (next: CallSettings) => void }) {
  const rows: Array<{ key: keyof CallSettings; label: string; description: string }> = [
    { key: 'sound', label: 'Âm thanh cuộc gọi', description: 'Phát âm báo khi gọi và khi có cuộc gọi đến.' },
    { key: 'vibration', label: 'Rung khi có cuộc gọi', description: 'Rung nhẹ trên thiết bị hỗ trợ rung.' },
    { key: 'floatingWindow', label: 'Hiển thị cửa sổ cuộc gọi nổi', description: 'Cho phép thu nhỏ cuộc gọi trong khi nhắn tin.' },
    { key: 'autoTimeout', label: 'Tự động kết thúc nếu không trả lời sau 1 phút', description: 'Tự đóng cuộc gọi khi không có phản hồi.' },
    { key: 'allowVoice', label: 'Cho phép cuộc gọi thoại', description: 'Nhận và thực hiện cuộc gọi thoại.' },
    { key: 'allowVideo', label: 'Cho phép cuộc gọi video', description: 'Nhận và thực hiện cuộc gọi video.' },
    { key: 'allowGroup', label: 'Cho phép cuộc gọi nhóm', description: 'Tham gia cuộc gọi trong nhóm.' },
    { key: 'ringGroup', label: 'Đổ chuông khi có cuộc gọi nhóm', description: 'Phát chuông với cuộc gọi nhóm đến.' },
    { key: 'missedNotifications', label: 'Thông báo cuộc gọi nhỡ', description: 'Hiển thị thông báo khi bỏ lỡ cuộc gọi.' },
    { key: 'showSpeaker', label: 'Hiển thị người đang nói', description: 'Làm nổi bật thành viên đang nói.' },
    { key: 'autoMuteOnJoin', label: 'Tự động tắt mic khi tham gia', description: 'Vào cuộc gọi với mic đang tắt.' },
    { key: 'autoCameraOffOnJoin', label: 'Tự động tắt camera khi tham gia', description: 'Vào cuộc gọi video với camera đang tắt.' },
    { key: 'blockStrangers', label: 'Chặn cuộc gọi từ người lạ', description: 'Không nhận cuộc gọi từ người chưa kết bạn.' },
  ]

  return (
    <div className={styles.settingsPanel}>
      {rows.map((row) => (
        <div key={row.key} className={styles.settingRow}>
          <span>
            {row.label}
            <small>{row.description}</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings[row.key]}
            className={cn(styles.switch, settings[row.key] && styles.switchOn)}
            onClick={() => onChange({ ...settings, [row.key]: !settings[row.key] })}
          >
            <i />
          </button>
        </div>
      ))}
      <div className={styles.settingRow}>
        <span>
          Bảo mật cuộc gọi
          <small>Cuộc gọi sử dụng kết nối thời gian thực giữa các thiết bị.</small>
        </span>
        <LockKeyhole size={20} color="#4666ff" />
      </div>
    </div>
  )
}

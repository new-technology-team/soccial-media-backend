import { ArrowLeft, BrainCircuit, Info, Phone, Search, UserPlus, Video, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils'
import type { Conversation, FriendConnection } from '@/types'

type ConversationHeaderProps = {
  selectedConversation: Conversation | null
  selectedConversationId: string | null
  selectedName: string
  directPeer: { id: number; avatarUrl: string | null; online: boolean; lastActiveAt?: string | null } | null
  isDirectPeerFriend: boolean
  directPeerActivityLabel: string
  callTargetId: number | null
  isSummarizing: boolean
  isAnalyzingSentiment: boolean
  showMessageFilters: boolean
  messageSearchKeyword: string
  canAddMembers: boolean
  selectedGroup: boolean
  setMobileShowList: (show: boolean) => void
  handleSummarizeChat: () => void
  handleAnalyzeSentiment: () => void
  handleStartCall: (type: 'video' | 'voice') => void
  setShowMessageFilters: (value: React.SetStateAction<boolean>) => void
  setRightPanelSection: (section: 'overview' | 'members' | 'manage') => void
  setShowSettingsDrawer: (show: boolean) => void
}

export function ConversationHeader({
  selectedConversation,
  selectedConversationId,
  selectedName,
  directPeer,
  isDirectPeerFriend,
  directPeerActivityLabel,
  callTargetId,
  isSummarizing,
  isAnalyzingSentiment,
  showMessageFilters,
  messageSearchKeyword,
  canAddMembers,
  selectedGroup,
  setMobileShowList,
  handleSummarizeChat,
  handleAnalyzeSentiment,
  handleStartCall,
  setShowMessageFilters,
  setRightPanelSection,
  setShowSettingsDrawer,
}: ConversationHeaderProps) {
  const fallback = (selectedName[0] || 'C').toUpperCase()

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          type="button" 
          className="p-2 -ml-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors sm:hidden" 
          onClick={() => setMobileShowList(true)} 
          title="Quay lại danh sách"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            {selectedConversation?.avatarUrl || directPeer?.avatarUrl ? (
              <img src={selectedConversation?.avatarUrl || directPeer?.avatarUrl || ''} alt={selectedName} className="w-10 h-10 rounded-full object-cover shadow-sm" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-lg font-bold shadow-sm">
                {fallback}
              </div>
            )}
            {directPeer?.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </div>
          
          <div className="flex flex-col min-w-0">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
              {directPeer ? <Link to={`/profile/${directPeer.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{selectedName}</Link> : selectedName}
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate">
              {directPeer
                ? isDirectPeerFriend
                  ? `Bạn bè • ${directPeerActivityLabel}`
                  : 'Chưa kết bạn • Giới hạn 3 tin nhắn'
                : `${selectedConversation?.onlineCount || 0} thành viên online`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="hidden lg:flex items-center gap-1 mr-2 px-2 border-r border-slate-200 dark:border-slate-800">
          <button            type="button" 
            className="p-2 rounded-full text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50 transition hover:scale-105 active:scale-95 relative group"
            onClick={handleSummarizeChat} 
            disabled={isSummarizing || !selectedConversationId} 
            title="Tóm tắt đoạn chat (AI)"
          >
            <Wand2 size={18} />
            {isSummarizing && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-purple-500 animate-ping" />}
          </button>
          <button            type="button" 
            className="p-2 rounded-full text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 transition hover:scale-105 active:scale-95 relative group"
            onClick={handleAnalyzeSentiment} 
            disabled={isAnalyzingSentiment || !selectedConversationId} 
            title="Phân tích cảm xúc (AI)"
          >
            <BrainCircuit size={18} />
            {isAnalyzingSentiment && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />}
          </button>
        </div>

        <button          type="button" 
          className="p-2 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition hover:scale-105 active:scale-95"
          onClick={() => handleStartCall('video')} 
          disabled={!selectedConversationId || (selectedConversation?.members?.length || 0) <= 1} 
          title="Gọi video"
        >
          <Video size={18} />
        </button>
        <button          type="button" 
          className="p-2 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition hover:scale-105 active:scale-95"
          onClick={() => handleStartCall('voice')} 
          disabled={!selectedConversationId || (selectedConversation?.members?.length || 0) <= 1} 
          title="Gọi thoại"
        >
          <Phone size={18} />
        </button>
        <button
          type="button"
          className={cn(
            "p-2 rounded-full transition-colors hidden sm:flex",
            showMessageFilters || messageSearchKeyword 
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" 
              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
          title="Tìm tin nhắn"
          disabled={!selectedConversation}
          onClick={() => setShowMessageFilters((value) => !value)}
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition hover:scale-105 active:scale-95 hidden sm:flex"
          title="Thêm người vào cuộc trò chuyện"
          disabled={!selectedGroup || !canAddMembers}
          onClick={() => {
            setRightPanelSection('manage')
            setShowSettingsDrawer(true)
          }}
        >
          <UserPlus size={18} />
        </button>
        <button
          type="button"
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition hover:scale-105 active:scale-95"
          title="Xem chi tiết cuộc trò chuyện"
          disabled={!selectedConversation}
          onClick={() => {
            setRightPanelSection('overview')
            setShowSettingsDrawer(true)
          }}
        >
          <Info size={18} />
        </button>
      </div>
    </header>
  )
}

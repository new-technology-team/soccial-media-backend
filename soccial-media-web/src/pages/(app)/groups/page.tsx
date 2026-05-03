'use client'

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CirclePlus, Search, Send, Smile, Video } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import type { ChatMessage, Conversation } from '@/lib/types'
import styles from './page.module.css'

const parseGroupMessageDate = (value: string) => {
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return new Date()
  if (typeof value === 'string' && value.endsWith('Z')) {
    return new Date(base.getTime() + 7 * 60 * 60 * 1000)
  }
  return base
}

export default function GroupsPage() {
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  const [groups, setGroups] = useState<Conversation[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!token) return
    api.listConversations(token).then((res) => {
      const items = res.conversations.filter((c) => c.type === 'group')
      setGroups(items)
      if (!selectedGroupId && items.length > 0) {
        setSelectedGroupId(items[0].id)
      }
    }).catch(console.error)
  }, [token, selectedGroupId])

  useEffect(() => {
    if (!token || !selectedGroupId) return
    api.listMessages(token, selectedGroupId).then((res) => setMessages(res.messages)).catch(console.error)
  }, [token, selectedGroupId])

  const selectedGroup = groups.find((item) => item.id === selectedGroupId) || null

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => (g.name || '').toLowerCase().includes(q))
  }, [groups, query])

  const handleSend = async () => {
    if (!token || !selectedGroupId || !draft.trim()) return
    try {
      const res = await api.sendMessage(token, selectedGroupId, draft.trim())
      setMessages((prev) => [...prev, res.message])
      setDraft('')
    } catch (error) {
      console.error('Không thể gửi tin nhắn nhóm', error)
    }
  }

  const renderGroupMessageContent = (msg: ChatMessage) => {
    if (msg.type === 'image' && msg.mediaUrl) {
      return <img src={msg.mediaUrl} alt={msg.fileName || 'image'} className={styles.messageMedia} />
    }

    if (msg.mediaUrl) {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
          {msg.fileName || 'Mở tệp đính kèm'}
        </a>
      )
    }

    return <p>{msg.text || ''}</p>
  }

  return (
    <div className={styles.page}>
      <aside className={styles.groupsCol}>
        <h2>Nhóm chat</h2>
        <div className={styles.searchWrap}>
          <Search size={15} />
          <input placeholder="Tìm kiếm nhóm..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className={styles.groupList}>
          {filteredGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`${styles.groupItem} ${group.id === selectedGroupId ? styles.groupItemActive : ''}`}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <div className={styles.groupAvatar}>{(group.name?.[0] || 'G').toUpperCase()}</div>
              <div className={styles.groupMeta}>
                <strong>{group.name || `Nhóm ${group.id}`}</strong>
                <small>{group.members.length} thành viên</small>
              </div>
            </button>
          ))}
          {filteredGroups.length === 0 ? <p className={styles.empty}>Không có nhóm phù hợp.</p> : null}
        </div>
      </aside>

      <section className={styles.chatCol}>
        <header className={styles.chatHeader}>
          <div>
            <h3>{selectedGroup?.name || 'Chọn nhóm chat'}</h3>
            <p>{selectedGroup ? `${selectedGroup.members.length} thành viên` : '---'}</p>
          </div>
          <div className={styles.chatActions}>
            <button type="button" title="Tìm trong nhóm"><Search size={16} /></button>
            <button type="button" title="Gọi video nhóm"><Video size={16} /></button>
          </div>
        </header>

        <div className={styles.messages}>
          {messages.map((msg) => {
            const mine = msg.senderId === user?.id
            return (
              <div key={msg.id} className={`${styles.msgRow} ${mine ? styles.msgRowMine : ''}`}>
                {!mine ? <div className={styles.msgAvatar}>{(msg.senderName?.[0] || 'U').toUpperCase()}</div> : null}
                <div className={`${styles.msgBubble} ${mine ? styles.msgBubbleMine : ''}`}>
                  {!mine ? <Link to={`/profile/${msg.senderId}`}><b>{msg.senderName}</b></Link> : null}
                  {renderGroupMessageContent(msg)}
                  <small>
                    {parseGroupMessageDate(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </small>
                </div>
              </div>
            )
          })}
          {messages.length === 0 ? <p className={styles.empty}>Nhóm này chưa có tin nhắn.</p> : null}
        </div>

        <footer className={styles.composer}>
          <button type="button" className={styles.iconBtn} title="Thêm nội dung"><CirclePlus size={16} /></button>
          <input
            placeholder="Nhắn tin cho nhóm..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button type="button" className={styles.iconBtn} title="Chèn emoji"><Smile size={16} /></button>
          <button type="button" className={styles.sendBtn} title="Gửi tin nhắn" onClick={handleSend} disabled={!draft.trim()}>
            <Send size={16} />
          </button>
        </footer>
      </section>

      <aside className={styles.infoCol}>
        <div className={styles.infoCard}>
          <div className={styles.heroAvatar}>{(selectedGroup?.name?.[0] || 'G').toUpperCase()}</div>
          <h4>{selectedGroup?.name || 'Chưa chọn nhóm'}</h4>
          <p>{selectedGroup ? `Thành lập #${selectedGroup.id}` : 'Không có dữ liệu'}</p>
        </div>

        <div className={styles.infoCard}>
          <h5>Thành viên ({selectedGroup?.members.length || 0})</h5>
          <div className={styles.memberList}>
            {selectedGroup?.members.slice(0, 8).map((member) => (
              <div key={member.userId} className={styles.memberItem}>
                <div className={styles.memberAvatar}>{(member.fullName[0] || 'U').toUpperCase()}</div>
                <div>
                  <Link to={`/profile/${member.userId}`}><b>{member.fullName}</b></Link>
                  <small>{member.role}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, Trash2, UserRound, AlertCircle } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/contexts/auth-store'
import styles from './page.module.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
}

function buildHistory(messages: ChatMessage[]) {
  // LĂ¡»c lĂ¡º¥y các tin nhĂ¡º¯n không lĂ¡»—i và map sang dạng { role, text }
  const mapped = messages
    .filter((m) => !m.isError)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      text: m.content,
    }))

  // Google Generative AI yêu cầu history phĂ¡º£i BĂ¡º®T ĐĂ¡º¦U bằng 'user'
  // Do đó ta loại bĂ¡» các tin nhĂ¡º¯n 'model' (như tin nhĂ¡º¯n welcome) Ă¡»Ÿ đầu mĂ¡º£ng
  while (mapped.length > 0 && mapped[0].role === 'model') {
    mapped.shift()
  }

  return mapped
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi là trĂ¡»£ lý AI cĂ¡»§a ZChat. Bạn có thĂ¡»ƒ hĂ¡»i vĂ¡» cách sĂ¡»  dĂ¡»¥ng nĂ¡»n tĂ¡º£ng, tìm nĂ¡»™i dung hoặc nhĂ¡º­n hĂ¡»— trĂ¡»£ nhanh.',
  timestamp: new Date(),
}

const quickPrompts = [
  'HưĂ¡»›ng dẫn tôi đăng bài trên ZChat',
  'Làm sao để gĂ¡» i Ă¡º£nh trong chat?',
  'Cách kĂ¡º¿t bạn trên ZChat?',
  'Tôi quên mĂ¡º­t khẩu phĂ¡º£i làm gì?',
]

export default function AIChatPage() {
  const token = useAuthStore((state) => state.accessToken || undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!token) return

    const fetchHistory = async () => {
      try {
        const historyData = await api.getAiHistory(token)
        if (historyData && historyData.length > 0) {
          const loadedMessages: ChatMessage[] = historyData.map((h, i) => ({
            id: `hist-${i}`,
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.text,
            timestamp: new Date(), // API backend hiện chưa trả về createdAt trong DTO history, ta dùng tạm Date.now. Có thể cải thiện sau.
          }))
          setMessages(loadedMessages)
        }
      } catch (error) {
        console.error('Failed to load AI chat history', error)
      }
    }

    fetchHistory()
  }, [token])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      // GĂ¡»­i history (loại bĂ¡» tin nhĂ¡º¯n lĂ¡»—i) để AI nhĂ¡»› ngĂ¡»¯ cĂ¡º£nh
      const history = buildHistory(messages) // messages trưĂ¡»›c khi có userMessage mĂ¡»›i nhĂ¡º¥t
      const data = await api.aiChat(token, text, history)

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || data.message || 'Xin lĂ¡»—i, hiĂ¡»‡n chưa có phĂ¡º£n hĂ¡»“i.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'ĐĂ£ có lĂ¡»—i xĂ¡º£y ra. Vui lòng thĂ¡»  lại.'
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: errText,
          timestamp: new Date(),
          isError: true,
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleClearChat = () => {
    setMessages([{ ...WELCOME_MESSAGE, id: Date.now().toString(), timestamp: new Date() }])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <p className={styles.badge}>
              <Sparkles size={14} /> TrĂ¡»£ lý AI ZChat
            </p>
            <h1>HĂ¡»i nhanh, nhĂ¡º­n hưĂ¡»›ng dẫn rõ</h1>
            <p>
              Bạn có thĂ¡»ƒ hĂ¡»i vĂ¡» chĂ¡»©c năng, tìm nĂ¡»™i dung, hoặc nhĂ¡» AI hưĂ¡»›ng dẫn thao tác nhanh trong hĂ¡»‡ thống.
            </p>
          </div>
          <button type="button" className={styles.clearBtn} onClick={handleClearChat}>
            <Trash2 size={15} /> Xóa hĂ¡»™i thoại
          </button>
        </header>

        <section className={styles.promptRail}>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => {
                setInput(prompt)
                inputRef.current?.focus()
              }}
              className={styles.promptChip}
            >
              {prompt}
            </button>
          ))}
        </section>

        <section className={styles.chatCard}>
          <div className={styles.messagesPane}>
            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}>
                <div className={styles.avatar}>
                  {msg.role === 'assistant' ? <Bot size={16} /> : <UserRound size={16} />}
                </div>
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : msg.isError ? styles.bubbleError : styles.bubbleAssistant}`}>
                  {msg.isError && <AlertCircle size={14} style={{ marginBottom: 4, opacity: 0.8 }} />}
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  <time dateTime={msg.timestamp.toISOString()}>
                    {msg.timestamp.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className={styles.messageRow}>
                <div className={styles.avatar}>
                  <Bot size={16} />
                </div>
                <div className={styles.typing}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputBar}>
            <input
              ref={inputRef}
              placeholder={token ? 'NhĂ¡º­p câu hĂ¡»i của bạn...' : 'Vui lòng đăng nhĂ¡º­p để chat vĂ¡»›i AI...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={isLoading || !token}
            />
            <button type="button" onClick={handleSend} disabled={!input.trim() || isLoading || !token}>
              <Send size={16} /> GĂ¡»­i
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}


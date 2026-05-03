'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, Trash2, UserRound } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth-store'
import styles from './page.module.css'

export default function AIChatPage() {
  const token = useAuthStore((state) => state.accessToken || undefined)
  const [messages, setMessages] = useState<Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>>([
    {
      id: '1',
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI của hệ thống. Bạn có thể hỏi về cách sử dụng nền tảng, tìm nội dung hoặc nhận hỗ trợ nhanh.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const quickPrompts = [
    '/search zchat',
    '/translate en: xin chào',
    'Hướng dẫn đăng bài chuẩn trên ZChat',
    'Tóm tắt tính năng dành cho khách vãng lai',
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const data = await api.aiChat(input)
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: data.reply || data.message || 'Xin lỗi, hiện chưa có phản hồi.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Bạn muốn mình hỗ trợ gì tiếp theo?',
        timestamp: new Date(),
      },
    ])
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <p className={styles.badge}>
              <Sparkles size={14} /> Trợ lý AI ZChat
            </p>
            <h1>Hỏi nhanh, nhận hướng dẫn rõ</h1>
            <p>
              Bạn có thể hỏi về chức năng, tìm nội dung, hoặc nhờ AI hướng dẫn thao tác nhanh trong hệ thống.
            </p>
          </div>
          <button type="button" className={styles.clearBtn} onClick={handleClearChat}>
            <Trash2 size={15} /> Xóa hội thoại
          </button>
        </header>

        <section className={styles.promptRail}>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
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
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
                  <p>{msg.content}</p>
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
              placeholder="Nhập câu hỏi của bạn..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={isLoading}
            />
            <button type="button" onClick={handleSend} disabled={!input.trim() || isLoading}>
              <Send size={16} /> Gửi
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

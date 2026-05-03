'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Image, Smile, MapPin } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { FeedPost } from '@/lib/types'

export default function PostCreator({ onCreated }: { onCreated?: (post: FeedPost) => void }) {
  const [content, setContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const token = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)

  const handlePost = async () => {
    if (!content.trim()) return

    setIsPosting(true)
    try {
      const response = await api.createPost({ content })
      const raw = response.post as Record<string, unknown>
      const created: FeedPost = {
        id: Number(raw.id ?? 0),
        authorId: Number(raw.owner?.userId ?? 0),
        authorName: String(raw.owner?.displayName ?? 'Người dùng'),
        authorAvatar: (raw.owner?.avatarUrl as string | undefined) ?? null,
        content: String(raw.content ?? ''),
        mediaUrl: (raw.mediaUrl as string) || null,
        visibility: (raw.visibility as 'public' | 'private') || 'public',
        status: 'published',
        reactionCount: 0,
        commentCount: 0,
        viewerReaction: null,
        createdAt: String(raw.createdAt ?? new Date().toISOString()),
      }
      setContent('')
      onCreated?.(created)
    } catch (error) {
      console.error('Failed to post:', error)
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <Card className="surface-card">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.avatarUrl || ''} />
            <AvatarFallback>{user?.fullName?.[0] || 'U'}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <Textarea
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none min-h-[100px]"
              disabled={isPosting}
            />

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Image className="w-4 h-4 mr-2" />
                  Ảnh
                </Button>
                <Button variant="ghost" size="sm">
                  <Smile className="w-4 h-4 mr-2" />
                  Cảm xúc
                </Button>
                <Button variant="ghost" size="sm">
                  <MapPin className="w-4 h-4 mr-2" />
                  Vị trí
                </Button>
              </div>

              <Button
                onClick={handlePost}
                disabled={!content.trim() || isPosting}
              >
                {isPosting ? 'Dang dang...' : 'Dang bai'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

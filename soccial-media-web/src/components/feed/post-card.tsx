'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FeedPost } from '@/types'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'

interface PostCardProps {
  post: FeedPost
}

export default function PostCard({ post }: PostCardProps) {
  const token = useAuthStore((state) => state.accessToken)
  const [liked, setLiked] = useState(Boolean(post.viewerReaction))
  const [likeCount, setLikeCount] = useState(post.reactionCount)

  const handleLike = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount(newLiked ? likeCount + 1 : likeCount - 1)

    try {
      if (newLiked) {
        await api.reactPost(String(post.id))
      } else {
        await api.unreactPost(String(post.id))
      }
    } catch (error) {
      setLiked(!newLiked)
      setLikeCount(newLiked ? likeCount - 1 : likeCount + 1)
    }
  }

  const formatDate = (date: string) => {
    const dateObj = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - dateObj.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'vĂ¡»«a xong'
    if (diffMins < 60) return `${diffMins} phút trưĂ¡»›c`
    if (diffHours < 24) return `${diffHours} giĂ¡» trưĂ¡»›c`
    if (diffDays < 7) return `${diffDays} ngày trưĂ¡»›c`
    return dateObj.toLocaleDateString('vi-VN')
  }

  return (
    <Card className="surface-card hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.authorAvatar || ''} />
            <AvatarFallback>{post.authorName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <Link
              to={`/profile/${post.authorId}`}
              className="font-semibold hover:text-primary transition-colors"
            >
              {post.authorName}
            </Link>
            <p className="text-sm text-muted-foreground">{formatDate(post.createdAt)}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Báo cáo bài viết</DropdownMenuItem>
            <DropdownMenuItem>Lưu bài viết</DropdownMenuItem>
            <DropdownMenuItem>Sao chép liên kĂ¡º¿t</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
        <Link to={`/posts/${post.id}`} className="text-sm font-medium text-primary hover:underline">
          Xem chi tiết bài viết
        </Link>

        {post.mediaUrl && (
          <div className="relative w-full h-80 bg-muted rounded-lg overflow-hidden">
            <img
              src={post.mediaUrl}
              alt="Post image"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
          <button className="hover:text-foreground transition-colors">
            {likeCount} Thích
          </button>
          <button className="hover:text-foreground transition-colors">
            {post.commentCount} Bình luĂ¡º­n
          </button>
          <button className="hover:text-foreground transition-colors">
            0 Chia sẻ
          </button>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={handleLike}
          >
            <Heart
              className={`w-4 h-4 mr-2 ${
                liked ? 'fill-destructive text-destructive' : ''
              }`}
            />
            {liked ? 'ĐĂ£ thích' : 'Thích'}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <MessageCircle className="w-4 h-4 mr-2" />
            Bình luĂ¡º­n
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Chia sẻ
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


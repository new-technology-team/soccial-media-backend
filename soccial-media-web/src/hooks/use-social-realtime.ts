import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { normalizeFeedComment, normalizeFeedPost, resolveApiAssetUrl } from '@/api/client'
import { connectSocket } from '@/services/socket'
import type { FeedComment, FeedPost, User } from '@/types'

type CommentLists = Record<string | number, FeedComment[]>

type Options = {
  token: string | null
  user: User | null
  setPosts: Dispatch<SetStateAction<FeedPost[]>>
  setCommentLists?: Dispatch<SetStateAction<CommentLists>>
  setComments?: Dispatch<SetStateAction<FeedComment[]>>
  postId?: number | string | null
}

const sameId = (left: number | string | null | undefined, right: number | string | null | undefined) =>
  String(left ?? '') === String(right ?? '')

const keyOf = (value: number | string) => String(value)

const appendCommentOnce = (items: FeedComment[], comment: FeedComment): FeedComment[] => {
  const commentId = String(comment.id)
  const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null
  if (!parentId) {
    return items.some((item) => sameId(item.id, commentId)) ? items : [...items, comment]
  }
  return items.map((item) => {
    if (sameId(item.id, parentId)) {
      return { ...item, replies: appendCommentOnce(item.replies || [], comment) }
    }
    return { ...item, replies: item.replies ? appendCommentOnce(item.replies, comment) : [] }
  })
}

const removeCommentById = (items: FeedComment[], commentId: number | string | undefined): FeedComment[] =>
  items
    .filter((item) => !sameId(item.id, commentId))
    .map((item) => ({ ...item, replies: item.replies ? removeCommentById(item.replies, commentId) : [] }))

export function useSocialRealtime({ token, user, setPosts, setCommentLists, setComments, postId }: Options) {
  useEffect(() => {
    if (!token || !user?.id) return

    const socket = connectSocket(token, user.id)

    const applyPost = (post: FeedPost, mode: 'prepend' | 'replace') => {
      const normalized = normalizeFeedPost(post)
      setPosts((prev) => {
        const exists = prev.some((item) => sameId(item.id, normalized.id))
        if (mode === 'prepend' && !exists) return [normalized, ...prev]
        return prev.map((item) => (sameId(item.id, normalized.id) ? { ...item, ...normalized } : item))
      })
    }

    const onPostCreated = (payload: { post?: FeedPost }) => {
      if (payload?.post) applyPost(payload.post, 'prepend')
    }

    const onPostUpdated = (payload: { post?: FeedPost }) => {
      if (payload?.post) applyPost(payload.post, 'replace')
    }

    const onPostDeleted = (payload: { postId?: number | string }) => {
      setPosts((prev) => prev.filter((item) => !sameId(item.id, payload?.postId)))
    }

    const onPostReaction = (payload: {
      postId?: number | string
      actorId?: number | string
      reaction?: string | null
      reactionCount?: number
    }) => {
      setPosts((prev) =>
        prev.map((item) => {
          if (!sameId(item.id, payload?.postId)) return item
          return {
            ...item,
            reactionCount: Number(payload?.reactionCount ?? item.reactionCount),
            viewerReaction: sameId(payload?.actorId, user.id) ? payload?.reaction || null : item.viewerReaction,
          }
        })
      )
    }

    const onCommentCreated = (payload: {
      postId?: number | string
      comment?: FeedComment
      commentCount?: number
    }) => {
      setPosts((prev) =>
        prev.map((item) =>
          sameId(item.id, payload?.postId)
            ? { ...item, commentCount: Number(payload?.commentCount ?? item.commentCount + 1) }
            : item
        )
      )
      if (!payload?.comment) return
      const normalizedComment = normalizeFeedComment(payload.comment)
      if (setCommentLists) {
        const postKey = keyOf(normalizedComment.postId)
        setCommentLists((prev) => {
          const current = prev[postKey] || []
          if (current.some((item) => sameId(item.id, normalizedComment.id))) return prev
          return { ...prev, [postKey]: appendCommentOnce(current, normalizedComment) }
        })
      }
      if (setComments && (!postId || sameId(postId, payload.postId))) {
        setComments((prev) =>
          appendCommentOnce(prev, normalizedComment)
        )
      }
    }

    const onCommentDeleted = (payload: {
      postId?: number | string
      commentId?: number | string
      commentCount?: number
    }) => {
      setPosts((prev) =>
        prev.map((item) =>
          sameId(item.id, payload?.postId)
            ? { ...item, commentCount: Number(payload?.commentCount ?? Math.max(0, item.commentCount - 1)) }
            : item
        )
      )
      if (setCommentLists && payload?.postId) {
        const postKey = keyOf(payload.postId)
        setCommentLists((prev) => ({
          ...prev,
          [postKey]: removeCommentById(prev[postKey] || [], payload.commentId),
        }))
      }
      if (setComments && (!postId || sameId(postId, payload.postId))) {
        setComments((prev) => removeCommentById(prev, payload.commentId))
      }
    }

    const onAvatarUpdated = (payload: { userId?: number | string; avatarUrl?: string }) => {
      const avatarUrl = resolveApiAssetUrl(payload?.avatarUrl) ?? payload?.avatarUrl ?? null
      setPosts((prev) =>
        prev.map((item) => ({
          ...item,
          authorAvatar: sameId(item.authorId, payload?.userId) ? avatarUrl : item.authorAvatar,
          sharedPost: item.sharedPost
            ? {
                ...item.sharedPost,
                authorAvatar: sameId(item.sharedPost.authorId, payload?.userId) ? avatarUrl : item.sharedPost.authorAvatar,
              }
            : item.sharedPost,
        }))
      )
      if (setCommentLists) {
        setCommentLists((prev) => {
          const next: CommentLists = {}
          Object.entries(prev).forEach(([key, comments]) => {
            next[key] = comments.map((comment) =>
              sameId(comment.userId, payload?.userId) ? { ...comment, authorAvatar: avatarUrl } : comment
            )
          })
          return next
        })
      }
      if (setComments) {
        setComments((prev) =>
          prev.map((comment) => (sameId(comment.userId, payload?.userId) ? { ...comment, authorAvatar: avatarUrl } : comment))
        )
      }
    }

    socket.on('post:created', onPostCreated)
    socket.on('post:updated', onPostUpdated)
    socket.on('post:deleted', onPostDeleted)
    socket.on('post:reaction', onPostReaction)
    socket.on('post:reactionUpdated', onPostReaction)
    socket.on('comment:created', onCommentCreated)
    socket.on('comment:deleted', onCommentDeleted)
    socket.on('user:avatar-updated', onAvatarUpdated)

    return () => {
      socket.off('post:created', onPostCreated)
      socket.off('post:updated', onPostUpdated)
      socket.off('post:deleted', onPostDeleted)
      socket.off('post:reaction', onPostReaction)
      socket.off('post:reactionUpdated', onPostReaction)
      socket.off('comment:created', onCommentCreated)
      socket.off('comment:deleted', onCommentDeleted)
      socket.off('user:avatar-updated', onAvatarUpdated)
    }
  }, [postId, setCommentLists, setComments, setPosts, token, user])
}

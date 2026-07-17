'use client'

import { request, normalizeFeedPost, normalizeFeedComment, resolveApiAssetUrl } from './client'
import type { FeedPost, FeedComment, PostReactionViewer } from '@/types'

export function feedApi(token?: string) {
  const t = (tok?: string): string => tok || token || ''
  return {
    listFeed: (feedToken?: string) =>
      request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
        '/social/posts/feed', { method: 'GET' }, t(feedToken)
      ).then((res) => ({
        ...res,
        posts: (res.posts || []).map(normalizeFeedPost),
      })),

    listFeedWithParams: (params: { includeHidden?: boolean; limit?: number }, feedToken?: string) => {
      const query = new URLSearchParams()
      if (params.includeHidden) query.set('includeHidden', 'true')
      if (params.limit) query.set('limit', String(params.limit))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<{ posts: FeedPost[]; viewer: { id: number; role: string } | null }>(
        `/social/posts/feed${suffix}`, { method: 'GET' }, t(feedToken)
      ).then((res) => ({
        ...res,
        posts: (res.posts || []).map(normalizeFeedPost),
      }))
    },

    createPost: (payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private'; sharedPostId?: number | string }) =>
      request<FeedPost>(
        '/social/posts', { method: 'POST', body: JSON.stringify(payload) }, t()
      ).then((post) => ({ post: normalizeFeedPost(post) })),

    updatePost: (postId: number | string, payload: { content?: string; mediaUrl?: string; visibility?: 'public' | 'private' }) =>
      request<FeedPost>(
        `/social/posts/${postId}`, { method: 'PATCH', body: JSON.stringify(payload) }, t()
      ).then((post) => ({ message: 'Đã cập nhật', post: normalizeFeedPost(post) })),

    deletePost: (postId: number | string) =>
      request<{ message: string }>(`/social/posts/${postId}`, { method: 'DELETE' }, t()),

    getPost: (postId: number | string) =>
      request<{ post: FeedPost }>(`/social/posts/${postId}`, { method: 'GET' }, t())
        .then((res) => ({ post: normalizeFeedPost(res.post) })),

    uploadPostMediaBase64: (payload: { fileName: string; contentType: string; base64Data: string }) =>
      request<{ message?: string; mediaUrl?: string; fileUrl?: string }>(
        '/social/posts/upload-base64', { method: 'POST', body: JSON.stringify(payload) }, t()
      ).then((data) => ({
        message: data.message || 'Uploaded',
        mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
      })),

    savePost: (postId: number | string) =>
      request<{ saved: boolean }>(`/social/posts/${postId}/save`, { method: 'POST' }, t()),

    unsavePost: (postId: number | string) =>
      request<{ saved: boolean }>(`/social/posts/${postId}/save`, { method: 'DELETE' }, t()),

    listSavedPosts: () =>
      request<{ posts: FeedPost[] }>('/social/posts/saved', { method: 'GET' }, t())
        .then((res) => ({ posts: (res.posts || []).map(normalizeFeedPost) })),

    reactPost: (postId: number | string, type = 'like') =>
      request<FeedPost>(`/social/posts/${postId}/reaction`, { method: 'POST', body: JSON.stringify({ type }) }, t())
        .then((post) => ({ post: normalizeFeedPost(post) })),

    unreactPost: (postId: number | string) =>
      request<FeedPost>(`/social/posts/${postId}/reaction`, { method: 'DELETE' }, t())
        .then((post) => ({ post: normalizeFeedPost(post) })),

    listPostReactions: (postId: number | string) =>
      request<{ reactions: PostReactionViewer[] }>(`/social/posts/${postId}/reactions`, { method: 'GET' })
        .then((res) => ({ reactions: (res.reactions || []).map((item) => ({ ...item })) })),

    listComments: (postId: number | string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (params?.limit) query.set('limit', String(params.limit))
      if (params?.offset) query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<{ comments: FeedComment[]; total?: number; hasMore?: boolean }>(
        `/social/posts/${postId}/comments${suffix}`, { method: 'GET' }, t()
      ).then((res) => ({
        comments: (res.comments || []).map(normalizeFeedComment),
        total: res.total,
        hasMore: res.hasMore,
      }))
    },

    addComment: (postId: number | string, content: string, imageUrl?: string | null, parentCommentId?: number | string | null) =>
      request<{ comment: FeedComment }>(
        `/social/posts/${postId}/comments`,
        { method: 'POST', body: JSON.stringify({ content, imageUrl, parentCommentId }) },
        t()
      ).then((res) => ({ comment: normalizeFeedComment(res.comment) })),

    addCommentReply: (commentId: number | string, content: string, imageUrl?: string | null) =>
      request<{ comment: FeedComment }>(
        `/social/comments/${commentId}/reply`,
        { method: 'POST', body: JSON.stringify({ content, imageUrl }) },
        t()
      ).then((res) => ({ comment: normalizeFeedComment(res.comment) })),

    uploadCommentImageBase64: (payload: { fileName: string; contentType: string; base64Data: string }) =>
      request<{ message?: string; mediaUrl?: string; fileUrl?: string }>(
        '/social/comments/upload-base64', { method: 'POST', body: JSON.stringify(payload) }, t()
      ).then((data) => ({
        message: data.message || 'Uploaded',
        mediaUrl: resolveApiAssetUrl(data.mediaUrl || data.fileUrl || '') || '',
      })),

    deleteComment: (commentId: number | string) =>
      request<{ message: string }>(`/social/comments/${commentId}`, { method: 'DELETE' }, t()),

    reactComment: (commentId: number | string, type = 'like') =>
      request<{ message: string; comment: FeedComment }>(
        `/social/comments/${commentId}/reaction`,
        { method: 'POST', body: JSON.stringify({ type }) },
        t()
      ).then((res) => ({ ...res, comment: normalizeFeedComment(res.comment) })),

    unreactComment: (commentId: number | string) =>
      request<{ message: string }>(`/social/comments/${commentId}/reaction`, { method: 'DELETE' }, t()),

    listCommentReactions: (commentId: number | string) =>
      request<{ reactions: PostReactionViewer[] }>(`/social/comments/${commentId}/reactions`, { method: 'GET' }),
  }
}

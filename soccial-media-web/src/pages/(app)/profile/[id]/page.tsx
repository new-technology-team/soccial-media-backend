"use client"

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Rss, Settings } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth-store'
import { api } from '@/lib/api'
import type { FeedPost, FriendConnection } from '@/lib/types'
import styles from './page.module.css'

export default function ProfilePage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const profileId = params?.id || ''
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [socialActionBusy, setSocialActionBusy] = useState(false)
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false)

  useEffect(() => {
    api.listFeed(token || undefined).then((r) => setPosts(r.posts)).catch(console.error)
  }, [token])

  useEffect(() => {
    if (!token) return

    api
      .listFriends(token)
      .then((response) => {
        setFriends(response.friends)

        if (!profileId || (me?.id && String(me.id) === profileId)) {
          setFriendStatus('none')
          return
        }

        const matched = response.friends.find((friend) => String(friend.id) === profileId)
        setFriendStatus(matched?.status || 'none')
      })
      .catch(console.error)
  }, [me?.id, profileId, token])

  const userPosts = useMemo(
    () => posts.filter((post) => String(post.authorId) === profileId),
    [posts, profileId]
  )

  const acceptedFriends = useMemo(
    () => friends.filter((friend) => friend.status === 'accepted'),
    [friends]
  )

  const profileFriend = useMemo(
    () => friends.find((friend) => String(friend.id) === profileId) || null,
    [friends, profileId]
  )

  const profileMedia = useMemo(
    () => userPosts.filter((post) => Boolean(post.mediaUrl)).slice(0, 6),
    [userPosts]
  )

  const totalInteractions = useMemo(
    () => userPosts.reduce((sum, post) => sum + post.reactionCount + post.commentCount, 0),
    [userPosts]
  )

  const profileName =
    me?.id && String(me.id) === profileId
      ? me.fullName
      : userPosts[0]?.authorName || profileFriend?.fullName || `Người dùng #${profileId}`
  const profileAvatar =
    me?.id && String(me.id) === profileId
      ? me.avatarUrl
      : userPosts[0]?.authorAvatar || profileFriend?.avatarUrl || null
  const initials = (profileName[0] || 'U').toUpperCase()
  const isOwnProfile = Boolean(me?.id && String(me.id) === profileId)

  useEffect(() => {
    setProfileAvatarBroken(false)
  }, [profileAvatar])

  const roleText =
    isOwnProfile && me
      ? me.role === 'admin'
        ? 'Quản trị viên hệ thống'
        : me.role === 'moderator'
          ? 'Kiểm duyệt viên cộng đồng'
          : 'Thành viên ZChat'
      : profileFriend?.role === 'admin'
        ? 'Quản trị viên hệ thống'
        : profileFriend?.role === 'moderator'
          ? 'Kiểm duyệt viên cộng đồng'
          : 'Thành viên ZChat'

  const accountText =
    isOwnProfile && me
      ? me.accountStatus === 'active'
        ? 'Tài khoản hoạt động'
        : me.accountStatus === 'restricted'
          ? 'Tài khoản bị hạn chế'
          : me.accountStatus === 'hidden'
            ? 'Tài khoản đang ẩn'
            : 'Tài khoản đã xóa'
      : friendStatus === 'accepted'
        ? 'Đã kết bạn'
        : friendStatus === 'pending'
          ? 'Đang chờ xác nhận'
          : 'Chưa kết nối'

  const handleRequestFriend = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    setSocialActionBusy(true)
    try {
      await api.requestFriend(token, Number(profileId))
      setFriendStatus('pending')
    } catch (error) {
      console.error('Không thể gửi lời mời kết bạn', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleMessageUser = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    setSocialActionBusy(true)
    try {
      const conversations = await api.listConversations(token)
      const existing = conversations.conversations.find(
        (conversation) =>
          conversation.type === 'direct' &&
          conversation.members.some((member) => member.userId === Number(profileId))
      )

      if (existing) {
        navigate(`/messages?conversation=${existing.id}`)
        return
      }

      const created = await api.createDirectConversation(token, Number(profileId))
      navigate(`/messages?conversation=${created.conversation.id}`)
    } catch (error) {
      console.error('Không thể mở hội thoại', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.cover}>
        <div className={styles.coverGlow}></div>
      </section>

      <div className={styles.shell}>
        <header className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {profileAvatar && !profileAvatarBroken ? (
              <img
                src={profileAvatar}
                alt={profileName}
                className={styles.avatar}
                loading="lazy"
                onError={() => setProfileAvatarBroken(true)}
              />
            ) : (
              <div className={styles.avatar}>{initials}</div>
            )}
            <span className={styles.onlineDot}></span>
          </div>
          <div className={styles.titleBlock}>
            <h1>{profileName}</h1>
            <p>{roleText}</p>
          </div>
          {isOwnProfile ? (
            <Link to="/profile/edit" className={styles.editBtn}>
              Chỉnh sửa trang cá nhân
            </Link>
          ) : (
            <div className={styles.profileActionGroup}>
              <button type="button" className={styles.editBtn} onClick={handleMessageUser} disabled={socialActionBusy}>
                {socialActionBusy ? 'Đang mở...' : 'Nhắn tin'}
              </button>
              <button
                type="button"
                className={styles.followBtn}
                onClick={handleRequestFriend}
                disabled={socialActionBusy || friendStatus !== 'none'}
              >
                {friendStatus === 'accepted' ? 'Bạn bè' : friendStatus === 'pending' ? 'Đã gửi lời mời' : 'Kết bạn'}
              </button>
            </div>
          )}
        </header>

        <nav className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${styles.tabActive}`}>
            Bài viết
          </button>
          <button type="button" className={styles.tab}>
            Giới thiệu
          </button>
          <button type="button" className={styles.tab}>
            Bạn bè
          </button>
          <button type="button" className={styles.tab}>
            Ảnh
          </button>
          <button type="button" className={styles.tab}>
            Video
          </button>
        </nav>

        <div className={styles.grid}>
          <aside className={styles.leftCol}>
            <section className={styles.card}>
              <h3>Giới thiệu</h3>
              <ul className={styles.infoList}>
                <li>
                  <Settings size={16} /> Vai trò: <strong>{roleText}</strong>
                </li>
                <li>
                  <Rss size={16} /> Trạng thái: <strong>{accountText}</strong>
                </li>
                <li>
                  <Rss size={16} /> Bài viết công khai: <strong>{userPosts.length}</strong>
                </li>
                <li>
                  <Rss size={16} /> Tổng tương tác: <strong>{totalInteractions}</strong>
                </li>
              </ul>
              {isOwnProfile ? (
                <Link to="/profile/edit" className={styles.lightBtn}>
                  Chỉnh sửa chi tiết
                </Link>
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Ảnh</h3>
                <Link to="/media">Xem tất cả</Link>
              </div>
              <div className={styles.photosGrid}>
                {profileMedia.map((post) => (
                  <img
                    key={post.id}
                    src={post.mediaUrl || ''}
                    alt={`Media ${post.id}`}
                    className={styles.photoImage}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ))}
                {profileMedia.length === 0 ? <p className={styles.empty}>Chưa có ảnh/video.</p> : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Bạn bè</h3>
                <Link to="/friends">Xem tất cả</Link>
              </div>
              <p className={styles.friendsCount}>{acceptedFriends.length} người bạn</p>
              <div className={styles.friendsGrid}>
                {acceptedFriends.slice(0, 6).map((friend) => (
                  <div key={friend.id} className={styles.friendItem}>
                    <Link to={`/profile/${friend.id}`} className={styles.friendLink}>
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.fullName}
                          className={styles.friendAvatarImage}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className={styles.friendAvatar}>{(friend.fullName[0] || 'U').toUpperCase()}</div>
                      )}
                      <span>{friend.fullName}</span>
                    </Link>
                  </div>
                ))}
                {acceptedFriends.length === 0 ? <p className={styles.empty}>Chưa có bạn bè nào.</p> : null}
              </div>
            </section>
          </aside>

          <section className={styles.rightCol}>
            <section className={styles.card}>
              <div className={styles.composerTop}>
                <div className={styles.avatarMini}>{initials}</div>
                <button type="button" className={styles.askBtn}>
                  {profileName.split(' ')[0]} ơi, bạn đang nghĩ gì thế?
                </button>
              </div>
              <div className={styles.composerActions}>
                <button type="button">Video trực tiếp</button>
                <button type="button">Ảnh/Video</button>
                <button type="button">Cảm xúc/Hoạt động</button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.postsHead}>
                <h3>Bài viết</h3>
                <div className={styles.headActions}>
                  <button type="button">Bộ lọc</button>
                  <button type="button">Quản lý bài viết</button>
                </div>
              </div>

              <div className={styles.postsList}>
                {userPosts.map((post) => (
                  <article key={post.id} className={styles.postItem}>
                    <div className={styles.postAuthor}>
                      <div className={styles.avatarMini}>{(post.authorName[0] || 'U').toUpperCase()}</div>
                      <div>
                        <Link to={`/profile/${post.authorId}`} className={styles.postAuthorLink}>
                          <p>{post.authorName}</p>
                        </Link>
                        <span>{new Date(post.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                    <p className={styles.postText}>{post.content}</p>
                    {post.mediaUrl ? (
                      <img
                        src={post.mediaUrl}
                        alt="Post media"
                        className={styles.postMedia}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}
                    <div className={styles.postFoot}>
                      <span>{post.reactionCount} lượt thích</span>
                      <span>{post.commentCount} bình luận</span>
                    </div>
                  </article>
                ))}
                {userPosts.length === 0 ? <p className={styles.empty}>Người dùng này chưa có bài viết nào.</p> : null}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  )
}

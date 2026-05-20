"use client"

import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Rss, Settings } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import type { FeedPost, FriendConnection } from '@/types'
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
      : userPosts[0]?.authorName || profileFriend?.fullName || `NgưĂ¡»i dùng #${profileId}`
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
        ? 'QuĂ¡º£n trĂ¡»‹ viên hĂ¡»‡ thống'
        : me.role === 'moderator'
          ? 'KiĂ¡»ƒm duyĂ¡»‡t viên cĂ¡»™ng đĂ¡»“ng'
          : 'Thành viên ZChat'
      : profileFriend?.role === 'admin'
        ? 'QuĂ¡º£n trĂ¡»‹ viên hĂ¡»‡ thống'
        : profileFriend?.role === 'moderator'
          ? 'KiĂ¡»ƒm duyĂ¡»‡t viên cĂ¡»™ng đĂ¡»“ng'
          : 'Thành viên ZChat'

  const accountText =
    isOwnProfile && me
      ? me.accountStatus === 'active'
        ? 'Tài khoĂ¡º£n hoạt đĂ¡»™ng'
        : me.accountStatus === 'restricted'
          ? 'Tài khoĂ¡º£n bĂ¡»‹ hạn chĂ¡º¿'
          : me.accountStatus === 'hidden'
            ? 'Tài khoĂ¡º£n đang ẩn'
            : 'Tài khoĂ¡º£n đã xóa'
      : friendStatus === 'accepted'
        ? 'ĐĂ£ kĂ¡º¿t bạn'
        : friendStatus === 'pending'
          ? 'Ä ang chĂ¡» xác nhĂ¡º­n'
          : 'Chưa kết nối'

  const handleRequestFriend = async () => {
    if (!token || isOwnProfile || !Number(profileId)) return
    setSocialActionBusy(true)
    try {
      await api.requestFriend(token, Number(profileId))
      setFriendStatus('pending')
    } catch (error) {
      console.error('Không thể gĂ¡» i lĂ¡»i mĂ¡»i kĂ¡º¿t bạn', error)
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
      console.error('Không thể mĂ¡»Ÿ hĂ¡»™i thoại', error)
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
              ChĂ¡»‰nh sĂ¡»­a trang cá nhân
            </Link>
          ) : (
            <div className={styles.profileActionGroup}>
              <button type="button" className={styles.editBtn} onClick={handleMessageUser} disabled={socialActionBusy}>
                {socialActionBusy ? 'Ä ang mĂ¡»Ÿ...' : 'NhĂ¡º¯n tin'}
              </button>
              <button
                type="button"
                className={styles.followBtn}
                onClick={handleRequestFriend}
                disabled={socialActionBusy || friendStatus !== 'none'}
              >
                {friendStatus === 'accepted' ? 'Bạn bè' : friendStatus === 'pending' ? 'ĐĂ£ gĂ¡» i lĂ¡»i mĂ¡»i' : 'Kết bạn'}
              </button>
            </div>
          )}
        </header>

        <nav className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${styles.tabActive}`}>
            Bài viĂ¡º¿t
          </button>
          <button type="button" className={styles.tab}>
            GiĂ¡»›i thiĂ¡»‡u
          </button>
          <button type="button" className={styles.tab}>
            Bạn bè
          </button>
          <button type="button" className={styles.tab}>
            Ă¡º¢nh
          </button>
          <button type="button" className={styles.tab}>
            Video
          </button>
        </nav>

        <div className={styles.grid}>
          <aside className={styles.leftCol}>
            <section className={styles.card}>
              <h3>GiĂ¡»›i thiĂ¡»‡u</h3>
              <ul className={styles.infoList}>
                <li>
                  <Settings size={16} /> Vai trò: <strong>{roleText}</strong>
                </li>
                <li>
                  <Rss size={16} /> Trạng thái: <strong>{accountText}</strong>
                </li>
                <li>
                  <Rss size={16} /> Bài viĂ¡º¿t công khai: <strong>{userPosts.length}</strong>
                </li>
                <li>
                  <Rss size={16} /> TĂ¡»•ng tương tác: <strong>{totalInteractions}</strong>
                </li>
              </ul>
              {isOwnProfile ? (
                <Link to="/profile/edit" className={styles.lightBtn}>
                  ChĂ¡»‰nh sĂ¡»­a chi tiĂ¡º¿t
                </Link>
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Ă¡º¢nh</h3>
                <Link to="/media">Xem tĂ¡º¥t cĂ¡º£</Link>
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
                {profileMedia.length === 0 ? <p className={styles.empty}>Chưa có Ă¡º£nh/video.</p> : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h3>Bạn bè</h3>
                <Link to="/friends">Xem tĂ¡º¥t cĂ¡º£</Link>
              </div>
              <p className={styles.friendsCount}>{acceptedFriends.length} ngưĂ¡»i bạn</p>
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
                  {profileName.split(' ')[0]} ơi, bạn đang nghĩ gì thĂ¡º¿?
                </button>
              </div>
              <div className={styles.composerActions}>
                <button type="button">Video trĂ¡»±c tiĂ¡º¿p</button>
                <button type="button">Ă¡º¢nh/Video</button>
                <button type="button">CĂ¡º£m xúc/Hoạt đĂ¡»™ng</button>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.postsHead}>
                <h3>Bài viĂ¡º¿t</h3>
                <div className={styles.headActions}>
                  <button type="button">BĂ¡»™ lĂ¡»c</button>
                  <button type="button">QuĂ¡º£n lý bài viết</button>
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
                      <span>{post.reactionCount} lưĂ¡»£t thích</span>
                      <span>{post.commentCount} bình luĂ¡º­n</span>
                    </div>
                  </article>
                ))}
                {userPosts.length === 0 ? <p className={styles.empty}>NgưĂ¡»i dùng này chưa có bài viết nào.</p> : null}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  )
}


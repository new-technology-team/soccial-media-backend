import { Crown, LogOut, Trash2, UserCheck } from 'lucide-react'

import { getGroupRoleLabel } from '@/services/messages/formatters'
import type { Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'
import styles from '../page.module.css'

type GroupLeader = { fullName: string; userId: number } | null

type ConversationDetailsPanelProps = {
  selectedGroup: Conversation | null
  rightPanelSection: 'overview' | 'members' | 'manage'
  setRightPanelSection: (value: 'overview' | 'members' | 'manage') => void
  myGroupRole: string | null
  groupLeader: GroupLeader
  groupDeputy: GroupLeader
  canManageRoles: boolean
  canRemoveMembers: boolean
  canAddMembers: boolean
  canDissolveSelectedGroup: boolean
  canLeaderLeaveGroup: boolean
  groupSearchKeyword: string
  setGroupSearchKeyword: (value: string) => void
  filteredGroupInviteCandidates: FriendConnection[]
  groupActionBusyId: string | null
  userId?: number
  handleClearChatForMe: () => void | Promise<void>
  handleTransferLeader: (userId: number) => void | Promise<void>
  handleSetDeputyRole: (userId: number | null) => void | Promise<void>
  handleRemoveMemberFromGroup: (userId: number) => void | Promise<void>
  handleAddMemberToGroup: (userId: number) => void | Promise<void>
  handleLeaveGroup: () => void | Promise<void>
  handleDissolveGroup: () => void | Promise<void>
}

export function ConversationDetailsPanel({
  selectedGroup,
  rightPanelSection,
  setRightPanelSection,
  myGroupRole,
  groupLeader,
  groupDeputy,
  canManageRoles,
  canRemoveMembers,
  canAddMembers,
  canDissolveSelectedGroup,
  canLeaderLeaveGroup,
  groupSearchKeyword,
  setGroupSearchKeyword,
  filteredGroupInviteCandidates,
  groupActionBusyId,
  userId,
  handleClearChatForMe,
  handleTransferLeader,
  handleSetDeputyRole,
  handleRemoveMemberFromGroup,
  handleAddMemberToGroup,
  handleLeaveGroup,
  handleDissolveGroup,
}: ConversationDetailsPanelProps) {
  if (!selectedGroup) return null

  return (
    <>
      <div className={styles.detailsIdentity}>
        <div className={styles.detailsAvatar}>{(selectedGroup.name?.[0] || 'G').toUpperCase()}</div>
        <div className={styles.detailsIdentityText}>
          <strong>{selectedGroup.name || 'Nhom chat'}</strong>
          <small>Ban: {getGroupRoleLabel(myGroupRole)}</small>
        </div>
      </div>

      <div className={styles.detailsTabs}>
        {(['overview', 'members', 'manage'] as const).map((section) => (
          <button
            key={section}
            type="button"
            className={cn(rightPanelSection === section && styles.detailsTabActive)}
            onClick={() => setRightPanelSection(section)}
          >
            {section === 'overview' ? 'Tong quan' : section === 'members' ? 'Thanh vien' : 'Quan ly'}
          </button>
        ))}
      </div>

      {rightPanelSection === 'overview' ? (
        <>
          <div className={styles.detailsSection}>
            <strong>Vai tro chinh</strong>
            <div className={styles.groupMemberList}>
              <div className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{groupLeader?.fullName || 'Chua xac dinh'}</b>
                  <small>Truong nhom - ID {groupLeader?.userId ?? selectedGroup.createdBy}</small>
                </div>
                <Crown size={14} />
              </div>
              <div className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{groupDeputy?.fullName || 'Chua co pho nhom'}</b>
                  <small>{groupDeputy ? `Pho nhom - ID ${groupDeputy.userId}` : 'Can chi dinh de truong nhom co the roi nhom'}</small>
                </div>
                <UserCheck size={14} />
              </div>
            </div>
          </div>

          <div className={styles.detailsSection}>
            <strong>Thao tac nhanh</strong>
            <div className={styles.detailActionsGrid}>
              <button type="button" onClick={() => setRightPanelSection('manage')}>
                Quan ly quyen & thanh vien
              </button>
              <button type="button" onClick={() => void handleClearChatForMe()}>
                Xoa doan chat phia ban
              </button>
            </div>
          </div>
        </>
      ) : null}

      {rightPanelSection === 'members' ? (
        <div className={styles.detailsSection}>
          <strong>Danh sach thanh vien ({selectedGroup.members.length})</strong>
          <div className={styles.groupMemberList}>
            {selectedGroup.members.map((member) => (
              <div key={member.userId} className={styles.groupMemberRow}>
                <div className={styles.groupMemberInfo}>
                  <b>{member.fullName}{Number(member.userId) === Number(userId) ? ' (Ban)' : ''}</b>
                  <small>{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {rightPanelSection === 'manage' ? (
        <>
          <p className={styles.groupManageHint}>
            {canManageRoles
              ? 'Ban la truong nhom: co the phan quyen, them/xoa thanh vien, giai tan nhom va roi nhom.'
              : canRemoveMembers
                ? 'Ban la pho nhom: co the them/xoa thanh vien.'
                : 'Ban la thanh vien: chi co the roi nhom.'}
          </p>
          <div className={styles.detailsSection}>
            <strong>Quan ly thanh vien hien tai</strong>
            <div className={styles.groupMemberList}>
              {selectedGroup.members.map((member) => {
                const isSelf = Number(member.userId) === Number(userId)
                const isLeader = member.role === 'leader'
                const isDeputy = member.role === 'deputy'
                return (
                  <div key={member.userId} className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{member.fullName}{isSelf ? ' (Ban)' : ''}</b>
                      <small>{getGroupRoleLabel(member.role)} - ID {member.userId}</small>
                    </div>
                    {(canManageRoles || canRemoveMembers) && !isSelf ? (
                      <div className={styles.groupMemberActions}>
                        {canManageRoles && !isLeader ? (
                          <button type="button" disabled={groupActionBusyId === `role-${member.userId}`} onClick={() => void handleTransferLeader(member.userId)}>
                            {groupActionBusyId === `role-${member.userId}` ? 'Dang chuyen...' : 'Lam truong nhom'}
                          </button>
                        ) : null}
                        {canManageRoles && !isLeader ? (
                          <button type="button" disabled={groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}`} onClick={() => void handleSetDeputyRole(isDeputy ? null : member.userId)}>
                            {groupActionBusyId === `deputy-${isDeputy ? 'none' : member.userId}` ? 'Dang cap nhat...' : isDeputy ? 'Go pho nhom' : 'Gan pho nhom'}
                          </button>
                        ) : null}
                        <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === `remove-${member.userId}`} onClick={() => void handleRemoveMemberFromGroup(member.userId)}>
                          {groupActionBusyId === `remove-${member.userId}` ? 'Dang xoa...' : 'Xoa'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {canAddMembers ? (
            <div className={styles.detailsSection}>
              <strong>Them thanh vien</strong>
              <input className={styles.detailsSearchInput} value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tim ban be theo ten, email hoac ID" />
              <div className={styles.groupMemberList}>
                {filteredGroupInviteCandidates.map((friend) => (
                  <div key={friend.id} className={styles.groupMemberRow}>
                    <div className={styles.groupMemberInfo}>
                      <b>{friend.fullName}</b>
                      <small>{friend.email || friend.phone || `ID ${friend.id}`}</small>
                    </div>
                    <button type="button" disabled={groupActionBusyId === `add-${friend.id}`} onClick={() => void handleAddMemberToGroup(friend.id)}>
                      {groupActionBusyId === `add-${friend.id}` ? 'Dang them...' : 'Them'}
                    </button>
                  </div>
                ))}
                {filteredGroupInviteCandidates.length === 0 ? <p className={styles.groupManageHint}>Khong con ban be phu hop de them.</p> : null}
              </div>
            </div>
          ) : null}

          <div className={styles.detailsSection}>
            <strong>Hanh dong nhom</strong>
            <div className={styles.detailActionsGrid}>
              <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === 'leave-group' || (myGroupRole === 'leader' && !canLeaderLeaveGroup)} onClick={() => void handleLeaveGroup()}>
                <LogOut size={14} />
                {groupActionBusyId === 'leave-group' ? 'Dang roi nhom...' : 'Roi nhom'}
              </button>
              {canDissolveSelectedGroup ? (
                <button type="button" className={styles.dangerBtn} disabled={groupActionBusyId === 'dissolve-group'} onClick={() => void handleDissolveGroup()}>
                  <Trash2 size={14} />
                  {groupActionBusyId === 'dissolve-group' ? 'Dang giai tan...' : 'Giai tan nhom'}
                </button>
              ) : null}
            </div>
            {myGroupRole === 'leader' && !canLeaderLeaveGroup ? <small>Truong nhom chi co the roi nhom sau khi da co pho nhom.</small> : null}
          </div>
        </>
      ) : null}
    </>
  )
}

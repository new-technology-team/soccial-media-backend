"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const mongodb_1 = require("mongodb");
const typeorm_2 = require("typeorm");
const conversation_entity_1 = require("./conversation.entity");
const user_service_1 = require("../user/user.service");
const friendship_service_1 = require("../friendship/friendship.service");
let ConversationService = class ConversationService {
    constructor(conversationRepository, userService, friendshipService) {
        this.conversationRepository = conversationRepository;
        this.userService = userService;
        this.friendshipService = friendshipService;
    }
    mapConversation(conversation, viewerId) {
        return {
            id: String(conversation._id),
            type: conversation.type,
            name: conversation.name,
            avatarUrl: conversation.avatarUrl || null,
            createdBy: conversation.createdBy,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            members: (conversation.members || []).map((member) => ({
                userId: member.userId,
                fullName: member.fullName,
                avatarUrl: member.avatarUrl || null,
                role: this.normalizeRole(member.role),
                notificationsEnabled: member.notificationsEnabled !== false,
                lastReadAt: member.lastReadAt || null,
            })),
            lastMessage: conversation.lastMessage || null,
            unreadCount: 0,
            role: this.normalizeRole((conversation.members || []).find((item) => item.userId === viewerId)?.role),
            notificationsEnabled: (conversation.members || []).find((item) => item.userId === viewerId)?.notificationsEnabled !== false,
        };
    }
    normalizeRole(role) {
        const raw = String(role || '').toLowerCase();
        if (raw === 'leader' || raw === 'deputy' || raw === 'member') {
            return raw;
        }
        // Backward compatibility for old records.
        if (raw === 'admin') {
            return 'leader';
        }
        return 'member';
    }
    getMemberByUserId(conversation, userId) {
        return (conversation.members || []).find((item) => Number(item.userId) === Number(userId));
    }
    isLeader(conversation, userId) {
        return this.normalizeRole(this.getMemberByUserId(conversation, userId)?.role) === 'leader';
    }
    isLeaderOrDeputy(conversation, userId) {
        const role = this.normalizeRole(this.getMemberByUserId(conversation, userId)?.role);
        return role === 'leader' || role === 'deputy';
    }
    enforceSingleLeaderSingleDeputy(conversation) {
        if (!conversation || conversation.type !== 'group')
            return false;
        const members = Array.isArray(conversation.members) ? [...conversation.members] : [];
        if (members.length === 0)
            return false;
        let changed = false;
        let normalized = members.map((item) => {
            const nextRole = this.normalizeRole(item.role);
            if (nextRole !== item.role)
                changed = true;
            return { ...item, role: nextRole };
        });
        const leaderCandidates = normalized.filter((item) => item.role === 'leader');
        if (leaderCandidates.length === 0) {
            const owner = normalized.find((item) => Number(item.userId) === Number(conversation.createdBy));
            const fallback = owner || normalized[0];
            normalized = normalized.map((item) => Number(item.userId) === Number(fallback.userId) ? { ...item, role: 'leader' } : item);
            changed = true;
        }
        else if (leaderCandidates.length > 1) {
            const ownerLeader = leaderCandidates.find((item) => Number(item.userId) === Number(conversation.createdBy));
            const keep = ownerLeader || leaderCandidates[0];
            normalized = normalized.map((item) => {
                if (item.role !== 'leader')
                    return item;
                if (Number(item.userId) === Number(keep.userId))
                    return item;
                changed = true;
                return { ...item, role: 'member' };
            });
        }
        const leader = normalized.find((item) => item.role === 'leader');
        const deputyCandidates = normalized.filter((item) => item.role === 'deputy' && Number(item.userId) !== Number(leader?.userId));
        if (deputyCandidates.length > 1) {
            const keepDeputy = deputyCandidates[0];
            normalized = normalized.map((item) => {
                if (item.role !== 'deputy')
                    return item;
                if (Number(item.userId) === Number(keepDeputy.userId))
                    return item;
                changed = true;
                return { ...item, role: 'member' };
            });
        }
        conversation.members = normalized;
        return changed;
    }
    async listConversations(userId) {
        const rows = await this.conversationRepository.find();
        for (const row of rows) {
            if (this.enforceSingleLeaderSingleDeputy(row)) {
                await this.conversationRepository.save(row);
            }
        }
        const mine = rows.filter((item) => (item.members || []).some((m) => m.userId === userId));
        return { conversations: mine.map((item) => this.mapConversation(item, userId)) };
    }
    async createDirect(actorId, targetUserId) {
        if (actorId === targetUserId) {
            throw new common_1.BadRequestException('Không thể tạo hội thoại với chính mình');
        }
        const target = await this.userService.findOne(targetUserId);
        if (!target) {
            throw new common_1.NotFoundException('Người dùng không tồn tại');
        }
        const all = await this.conversationRepository.find();
        const existed = all.find((item) => item.type === 'direct' &&
            (item.members || []).length === 2 &&
            (item.members || []).some((m) => m.userId === actorId) &&
            (item.members || []).some((m) => m.userId === targetUserId));
        if (existed) {
            return { conversation: this.mapConversation(existed, actorId) };
        }
        const actor = await this.userService.findOne(actorId);
        const now = new Date();
        const conversation = this.conversationRepository.create({
            type: 'direct',
            name: `${actor?.displayName || 'Bạn'} - ${target.displayName || 'Người dùng'}`,
            avatarUrl: null,
            createdBy: actorId,
            createdAt: now,
            updatedAt: now,
            members: [
                {
                    userId: actorId,
                    fullName: actor?.displayName || 'Bạn',
                    avatarUrl: actor?.avatarUrl || null,
                    role: 'member',
                    notificationsEnabled: true,
                    lastReadAt: now,
                },
                {
                    userId: targetUserId,
                    fullName: target.displayName || 'Người dùng',
                    avatarUrl: target.avatarUrl || null,
                    role: 'member',
                    notificationsEnabled: true,
                    lastReadAt: null,
                },
            ],
            lastMessage: null,
        });
        const saved = await this.conversationRepository.save(conversation);
        return { conversation: this.mapConversation(saved, actorId) };
    }
    async createGroup(actorId, name, avatarUrl, memberIds) {
        const groupName = String(name || '').trim();
        if (!groupName) {
            throw new common_1.BadRequestException('Tên nhóm không được để trống');
        }
        const actor = await this.userService.findOne(actorId);
        const uniqueMemberIds = [...new Set(memberIds.filter((item) => item !== actorId))];
        if (uniqueMemberIds.length === 0) {
            throw new common_1.BadRequestException('Nhóm cần ít nhất 1 thành viên khác');
        }
        const acceptedFriendIds = await this.friendshipService.getAcceptedFriendIds(actorId);
        const nonFriendIds = uniqueMemberIds.filter((id) => !acceptedFriendIds.has(id));
        if (nonFriendIds.length > 0) {
            throw new common_1.ForbiddenException('Chỉ có thể thêm bạn bè vào nhóm chat');
        }
        const members = [
            {
                userId: actorId,
                fullName: actor?.displayName || 'Bạn',
                avatarUrl: actor?.avatarUrl || null,
                role: 'leader',
                notificationsEnabled: true,
                lastReadAt: new Date(),
            },
        ];
        for (const id of uniqueMemberIds) {
            const user = await this.userService.findOne(id);
            if (!user) {
                throw new common_1.NotFoundException(`Không tìm thấy user ${id}`);
            }
            members.push({
                userId: id,
                fullName: user.displayName,
                avatarUrl: user.avatarUrl || null,
                role: 'member',
                notificationsEnabled: true,
                lastReadAt: null,
            });
        }
        const now = new Date();
        const saved = await this.conversationRepository.save(this.conversationRepository.create({
            type: 'group',
            name: groupName,
            avatarUrl: avatarUrl || null,
            createdBy: actorId,
            createdAt: now,
            updatedAt: now,
            members,
            lastMessage: null,
        }));
        return { conversation: this.mapConversation(saved, actorId) };
    }
    async getConversationById(conversationId) {
        return this.conversationRepository.findOne({ where: { _id: new mongodb_1.ObjectId(conversationId) } });
    }
    async ensureMembership(conversationId, userId) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException('Không tìm thấy hội thoại');
        }
        if (this.enforceSingleLeaderSingleDeputy(conversation)) {
            await this.conversationRepository.save(conversation);
        }
        const joined = (conversation.members || []).some((item) => item.userId === userId);
        if (!joined) {
            throw new common_1.ForbiddenException('Bạn không thuộc cuộc trò chuyện này');
        }
        return conversation;
    }
    async getConversationDetail(conversationId, userId) {
        const conversation = await this.ensureMembership(conversationId, userId);
        return { conversation: this.mapConversation(conversation, userId) };
    }
    async setSeen(conversationId, userId) {
        const conversation = await this.ensureMembership(conversationId, userId);
        conversation.members = (conversation.members || []).map((item) => item.userId === userId ? { ...item, lastReadAt: new Date() } : item);
        await this.conversationRepository.save(conversation);
        return { message: 'Đã cập nhật trạng thái đã xem' };
    }
    async toggleNotifications(conversationId, userId, enabled) {
        const conversation = await this.ensureMembership(conversationId, userId);
        conversation.members = (conversation.members || []).map((item) => item.userId === userId ? { ...item, notificationsEnabled: Boolean(enabled) } : item);
        await this.conversationRepository.save(conversation);
        return { message: 'Đã cập nhật cài đặt thông báo' };
    }
    async addMember(conversationId, actorId, userId) {
        const conversation = await this.ensureMembership(conversationId, actorId);
        if (conversation.type !== 'group') {
            throw new common_1.BadRequestException('Chỉ hỗ trợ thêm thành viên cho nhóm chat');
        }
        if (!this.isLeaderOrDeputy(conversation, actorId)) {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền thêm thành viên');
        }
        if ((conversation.members || []).some((item) => item.userId === userId)) {
            return { message: 'Người dùng đã ở trong nhóm' };
        }
        const user = await this.userService.findOne(userId);
        if (!user) {
            throw new common_1.NotFoundException('Người dùng không tồn tại');
        }
        conversation.members = [
            ...(conversation.members || []),
            {
                userId,
                fullName: user.displayName,
                avatarUrl: user.avatarUrl || null,
                role: 'member',
                notificationsEnabled: true,
                lastReadAt: null,
            },
        ];
        await this.conversationRepository.save(conversation);
        return { message: 'Đã thêm thành viên' };
    }
    async removeMember(conversationId, actorId, targetUserId) {
        const conversation = await this.ensureMembership(conversationId, actorId);
        if (conversation.type !== 'group') {
            throw new common_1.BadRequestException('Chỉ hỗ trợ xóa thành viên cho nhóm chat');
        }
        if (!this.isLeaderOrDeputy(conversation, actorId)) {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền xóa thành viên');
        }
        if (!(conversation.members || []).some((item) => item.userId === targetUserId)) {
            throw new common_1.NotFoundException('Thành viên không tồn tại trong nhóm');
        }
        if (targetUserId === actorId) {
            throw new common_1.BadRequestException('Không thể tự xóa chính mình khỏi nhóm bằng chức năng này');
        }
        const target = this.getMemberByUserId(conversation, targetUserId);
        const actorRole = this.normalizeRole(this.getMemberByUserId(conversation, actorId)?.role);
        const targetRole = this.normalizeRole(target?.role);
        if (targetRole === 'leader') {
            throw new common_1.BadRequestException('Không thể xóa trưởng nhóm');
        }
        if (targetRole === 'deputy' && actorRole !== 'leader') {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm mới có thể xóa phó nhóm');
        }
        conversation.members = (conversation.members || []).filter((item) => item.userId !== targetUserId);
        await this.conversationRepository.save(conversation);
        return { message: 'Đã xóa thành viên' };
    }
    async transferLeader(conversationId, actorId, targetUserId) {
        const conversation = await this.ensureMembership(conversationId, actorId);
        if (conversation.type !== 'group') {
            throw new common_1.BadRequestException('Chỉ hỗ trợ chuyển quyền trưởng nhóm cho nhóm chat');
        }
        if (!this.isLeader(conversation, actorId)) {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm mới có quyền chuyển quyền trưởng nhóm');
        }
        if (Number(actorId) === Number(targetUserId)) {
            throw new common_1.BadRequestException('Không thể chuyển quyền cho chính mình');
        }
        const target = this.getMemberByUserId(conversation, targetUserId);
        if (!target) {
            throw new common_1.NotFoundException('Thành viên không tồn tại trong nhóm');
        }
        conversation.members = (conversation.members || []).map((item) => {
            if (Number(item.userId) === Number(actorId)) {
                return { ...item, role: 'member' };
            }
            if (Number(item.userId) === Number(targetUserId)) {
                return { ...item, role: 'leader' };
            }
            return this.normalizeRole(item.role) === 'leader' ? { ...item, role: 'member' } : item;
        });
        await this.conversationRepository.save(conversation);
        return { message: 'Đã chuyển quyền trưởng nhóm' };
    }
    async setDeputy(conversationId, actorId, targetUserId) {
        const conversation = await this.ensureMembership(conversationId, actorId);
        if (conversation.type !== 'group') {
            throw new common_1.BadRequestException('Chỉ hỗ trợ cấp quyền phó nhóm cho nhóm chat');
        }
        if (!this.isLeader(conversation, actorId)) {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm mới có quyền cấp quyền phó nhóm');
        }
        const desiredDeputyId = targetUserId ? Number(targetUserId) : null;
        if (desiredDeputyId && Number(desiredDeputyId) === Number(actorId)) {
            throw new common_1.BadRequestException('Trưởng nhóm không thể tự đặt làm phó nhóm');
        }
        if (desiredDeputyId) {
            const target = this.getMemberByUserId(conversation, desiredDeputyId);
            if (!target) {
                throw new common_1.NotFoundException('Thành viên không tồn tại trong nhóm');
            }
            if (this.normalizeRole(target.role) === 'leader') {
                throw new common_1.BadRequestException('Không thể gán trưởng nhóm làm phó nhóm');
            }
        }
        conversation.members = (conversation.members || []).map((item) => {
            const uid = Number(item.userId);
            const role = this.normalizeRole(item.role);
            if (role === 'leader')
                return { ...item, role: 'leader' };
            if (desiredDeputyId && uid === desiredDeputyId) {
                return { ...item, role: 'deputy' };
            }
            if (role === 'deputy') {
                return { ...item, role: 'member' };
            }
            return { ...item, role: 'member' };
        });
        await this.conversationRepository.save(conversation);
        return { message: desiredDeputyId ? 'Đã cấp quyền phó nhóm' : 'Đã thu hồi quyền phó nhóm' };
    }
    async updateAdmin(conversationId, actorId, userId, isAdmin) {
        // Backward-compat endpoint: map admin=true to deputy, admin=false to remove deputy.
        return this.setDeputy(conversationId, actorId, isAdmin ? Number(userId) : null);
    }
    async dissolveGroup(conversationId, actorId) {
        const conversation = await this.ensureMembership(conversationId, actorId);
        if (conversation.type !== 'group') {
            throw new common_1.BadRequestException('Chỉ hỗ trợ giải tán nhóm chat');
        }
        if (!this.isLeader(conversation, actorId)) {
            throw new common_1.ForbiddenException('Chỉ trưởng nhóm mới có quyền giải tán nhóm');
        }
        await this.conversationRepository.delete({ _id: new mongodb_1.ObjectId(conversationId) });
        return { message: 'Đã giải tán nhóm chat' };
    }
    async touchLastMessage(conversationId, payload) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            return;
        }
        conversation.lastMessage = payload;
        conversation.updatedAt = new Date();
        await this.conversationRepository.save(conversation);
    }
};
exports.ConversationService = ConversationService;
exports.ConversationService = ConversationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(conversation_entity_1.Conversation, 'mongodb')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        user_service_1.UserService,
        friendship_service_1.FriendshipService])
], ConversationService);
//# sourceMappingURL=conversation.service.js.map
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  Modal,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { TopBar } from "../components/common/TopBar";
import { EmptyState } from "../components/common/EmptyState";
import { ConversationItem } from "../components/chat/ConversationItem";
import { MessageBubble } from "../components/chat/MessageBubble";
import { MessageInput } from "../components/chat/MessageInput";
import { SearchBar } from "../components/search/SearchBar";
import { api } from "../lib/api";
import type { AuthUser, Conversation, Message } from "../types";

type FriendCandidate = {
  id: number;
  name: string;
  avatarUrl?: string;
  status?: string;
  requestedByMe?: boolean;
};

interface MessagesScreenProps {
  user: AuthUser;
  mode?: "all" | "groups";
}

export function MessagesScreen({ user, mode = "all" }: MessagesScreenProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [conversationKeyword, setConversationKeyword] = useState("");
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeMode, setComposeMode] = useState<"direct" | "group">("direct");
  const [composeKeyword, setComposeKeyword] = useState("");
  const [searchUsers, setSearchUsers] = useState<AuthUser[]>([]);
  const [friends, setFriends] = useState<FriendCandidate[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSubmittingCompose, setIsSubmittingCompose] = useState(false);

  const filteredConversations = useMemo(() => {
    const q = conversationKeyword.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const participants = (item.participants || [])
        .map((p) => String(p.name || "").toLowerCase())
        .join(" ");
      return (
        name.includes(q) ||
        participants.includes(q) ||
        (item.isGroup && "nhom group".includes(q))
      );
    });
  }, [conversations, conversationKeyword]);

  const conversationsForView = useMemo(() => {
    if (mode !== "groups") return filteredConversations;
    return filteredConversations.filter((item) => item.isGroup);
  }, [filteredConversations, mode]);

  const acceptedFriends = useMemo(
    () => friends.filter((item) => item.status === "accepted"),
    [friends],
  );

  const filteredFriends = useMemo(() => {
    const q = composeKeyword.trim().toLowerCase();
    if (!q) return acceptedFriends;
    return acceptedFriends.filter((item) =>
      String(item.name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [acceptedFriends, composeKeyword]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.listConversations();
      setConversations(res.conversations || []);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await api.listMessages(convId);
      setMessages(res.messages || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadFriends = useCallback(async () => {
    try {
      const res = await api.listFriends();
      setFriends((res.friends || []) as FriendCandidate[]);
    } catch {
      setFriends([]);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!showComposeModal || composeMode !== "direct") {
      setSearchUsers([]);
      return;
    }

    const q = composeKeyword.trim();
    if (q.length < 2) {
      setSearchUsers([]);
      return;
    }

    let canceled = false;
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await api.searchUsers(q);
        if (!canceled) setSearchUsers(res.users || []);
      } catch {
        if (!canceled) setSearchUsers([]);
      } finally {
        if (!canceled) setIsSearchingUsers(false);
      }
    }, 280);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [showComposeModal, composeMode, composeKeyword]);

  const resetCompose = () => {
    setComposeKeyword("");
    setSearchUsers([]);
    setGroupName("");
    setGroupMemberIds([]);
    setComposeMode("direct");
  };

  const openCompose = (mode: "direct" | "group") => {
    setShowComposeModal(true);
    setComposeMode(mode);
    setComposeKeyword("");
    setSearchUsers([]);
    setGroupName("");
    setGroupMemberIds([]);
  };

  const upsertConversation = (conversation: Conversation) => {
    setConversations((prev) => {
      const found = prev.find((item) => item.id === conversation.id);
      if (!found) return [conversation, ...prev];
      return prev.map((item) =>
        item.id === conversation.id ? conversation : item,
      );
    });
  };

  const handleCreateDirect = async (targetUserId: number) => {
    setIsSubmittingCompose(true);
    try {
      const res = await api.createDirectConversation(targetUserId);
      upsertConversation(res.conversation);
      setSelectedConv(res.conversation);
      await loadMessages(res.conversation.id);
      setShowComposeModal(false);
      resetCompose();
    } catch (err) {
      Alert.alert(
        "Không thể tạo hội thoại",
        err instanceof Error ? err.message : "Vui lòng thử lại",
      );
    } finally {
      setIsSubmittingCompose(false);
    }
  };

  const toggleGroupMember = (userId: number) => {
    setGroupMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((item) => item !== userId)
        : [...prev, userId],
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên nhóm.");
      return;
    }
    if (groupMemberIds.length === 0) {
      Alert.alert("Thiếu thành viên", "Nhóm cần ít nhất 1 thành viên khác.");
      return;
    }

    setIsSubmittingCompose(true);
    try {
      const res = await api.createGroupConversation({
        name: groupName.trim(),
        memberIds: groupMemberIds,
      });
      upsertConversation(res.conversation);
      setSelectedConv(res.conversation);
      await loadMessages(res.conversation.id);
      setShowComposeModal(false);
      resetCompose();
    } catch (err) {
      Alert.alert(
        "Không thể tạo nhóm",
        err instanceof Error ? err.message : "Vui lòng thử lại",
      );
    } finally {
      setIsSubmittingCompose(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConv) return;
    try {
      const res = await api.sendMessage(selectedConv.id, messageText.trim());
      setMessages((prev) => [...prev, res.message]);
      setMessageText("");
    } catch {
      /* silent */
    }
  };

  return (
    <View className="flex-1 bg-background">
      <TopBar
        title={
          selectedConv
            ? selectedConv.name || "Cuộc trò chuyện"
            : mode === "groups"
              ? "Nhóm chat"
              : "Tin nhắn"
        }
        leftAction={
          selectedConv
            ? { label: "← Quay lại", onPress: () => setSelectedConv(null) }
            : undefined
        }
        rightAction={
          !selectedConv ? (
            <TouchableOpacity
              className="px-3 py-1.5 rounded-full bg-primary"
              onPress={() =>
                openCompose(mode === "groups" ? "group" : "direct")
              }
            >
              <Text className="text-white text-xs font-semibold">
                {mode === "groups" ? "+ Nhóm" : "+ Mới"}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {!selectedConv ? (
        <>
          <SearchBar
            value={conversationKeyword}
            onChangeText={setConversationKeyword}
            placeholder={
              mode === "groups"
                ? "Tìm nhóm trò chuyện..."
                : "Tìm cuộc trò chuyện hoặc nhóm..."
            }
          />

          <FlatList
            data={conversationsForView}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                onPress={() => {
                  setSelectedConv(item);
                  loadMessages(item.id);
                }}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadConversations();
                }}
                tintColor="#0052ce"
              />
            }
            ListEmptyComponent={
              !isLoading ? (
                <EmptyState
                  icon="💬"
                  title={
                    conversationKeyword.trim().length
                      ? "Không tìm thấy cuộc trò chuyện phù hợp"
                      : mode === "groups"
                        ? "Chưa có nhóm nào"
                        : "Chưa có cuộc trò chuyện nào"
                  }
                  subtitle={
                    conversationKeyword.trim().length
                      ? "Thử từ khóa khác để tìm nhóm hoặc bạn bè"
                      : mode === "groups"
                        ? "Tạo nhóm để bắt đầu chat theo nhóm"
                        : "Bắt đầu trò chuyện với bạn bè!"
                  }
                />
              ) : null
            }
          />
        </>
      ) : (
        <View className="flex-1">
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <MessageBubble message={item} currentUserId={user.id} />
            )}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "flex-end",
              paddingVertical: 12,
            }}
          />
          <MessageInput
            value={messageText}
            onChangeText={setMessageText}
            onSend={handleSend}
          />
        </View>
      )}

      <Modal
        visible={showComposeModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowComposeModal(false);
          resetCompose();
        }}
      >
        <View className="flex-1 bg-black/45 justify-end">
          <View className="bg-surface rounded-t-3xl max-h-[85%] pb-5">
            <View className="px-4 py-4 border-b border-border flex-row items-center justify-between">
              <Text className="text-foreground text-base font-bold">
                {composeMode === "direct"
                  ? "Tạo hội thoại mới"
                  : "Tạo nhóm trò chuyện"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowComposeModal(false);
                  resetCompose();
                }}
              >
                <Text className="text-muted-foreground text-2xl font-light">
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <View className="px-4 py-3 flex-row">
              <TouchableOpacity
                className={`flex-1 rounded-xl py-2.5 items-center mr-2 ${composeMode === "direct" ? "bg-primary" : "bg-surface-secondary border border-border"}`}
                onPress={() => {
                  setComposeMode("direct");
                  setComposeKeyword("");
                }}
              >
                <Text
                  className={`text-xs font-semibold ${composeMode === "direct" ? "text-white" : "text-foreground"}`}
                >
                  Nhắn riêng
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl py-2.5 items-center ml-2 ${composeMode === "group" ? "bg-primary" : "bg-surface-secondary border border-border"}`}
                onPress={() => {
                  setComposeMode("group");
                  setComposeKeyword("");
                }}
              >
                <Text
                  className={`text-xs font-semibold ${composeMode === "group" ? "text-white" : "text-foreground"}`}
                >
                  Tạo nhóm
                </Text>
              </TouchableOpacity>
            </View>

            {composeMode === "direct" ? (
              <>
                <SearchBar
                  value={composeKeyword}
                  onChangeText={setComposeKeyword}
                  placeholder="Tìm người dùng để nhắn tin..."
                />
                <FlatList
                  data={searchUsers}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className="px-4 py-3 border-b border-border"
                      disabled={isSubmittingCompose}
                      onPress={() => {
                        void handleCreateDirect(item.id);
                      }}
                    >
                      <Text className="text-foreground font-semibold text-sm">
                        {item.fullName}
                      </Text>
                      <Text className="text-muted-foreground text-xs mt-0.5">
                        {item.email || item.phone || "Người dùng"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    composeKeyword.trim().length < 2 ? (
                      <View className="py-8">
                        <EmptyState
                          icon="👥"
                          title="Tìm người để bắt đầu chat"
                          subtitle="Nhập ít nhất 2 ký tự"
                        />
                      </View>
                    ) : isSearchingUsers ? (
                      <View className="py-8">
                        <EmptyState icon="⏳" title="Đang tìm kiếm..." />
                      </View>
                    ) : (
                      <View className="py-8">
                        <EmptyState
                          icon="🔍"
                          title="Không tìm thấy người dùng"
                        />
                      </View>
                    )
                  }
                />
              </>
            ) : (
              <>
                <View className="px-4">
                  <TextInput
                    className="h-11 rounded-xl border border-border bg-surface-secondary px-4 text-sm text-foreground"
                    placeholder="Tên nhóm"
                    placeholderTextColor="#7e8592"
                    value={groupName}
                    onChangeText={setGroupName}
                  />
                </View>

                <SearchBar
                  value={composeKeyword}
                  onChangeText={setComposeKeyword}
                  placeholder="Tìm bạn bè để thêm vào nhóm..."
                />

                <FlatList
                  data={filteredFriends}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const checked = groupMemberIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        className="px-4 py-3 border-b border-border flex-row items-center justify-between"
                        onPress={() => toggleGroupMember(item.id)}
                      >
                        <View>
                          <Text className="text-foreground font-semibold text-sm">
                            {item.name}
                          </Text>
                          <Text className="text-muted-foreground text-xs mt-0.5">
                            Bạn bè
                          </Text>
                        </View>
                        <Text
                          className={`text-xs font-semibold ${checked ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {checked ? "Đã chọn" : "Chọn"}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View className="py-8">
                      <EmptyState
                        icon="👥"
                        title="Không có bạn bè phù hợp"
                        subtitle="Chỉ bạn bè đã chấp nhận mới thêm được vào nhóm"
                      />
                    </View>
                  }
                />

                <View className="px-4 pt-3">
                  <TouchableOpacity
                    className={`rounded-xl py-3 items-center ${isSubmittingCompose ? "bg-primary/60" : "bg-primary"}`}
                    disabled={isSubmittingCompose}
                    onPress={() => {
                      void handleCreateGroup();
                    }}
                  >
                    <Text className="text-white font-semibold text-sm">
                      {isSubmittingCompose ? "Đang tạo nhóm..." : "Tạo nhóm"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

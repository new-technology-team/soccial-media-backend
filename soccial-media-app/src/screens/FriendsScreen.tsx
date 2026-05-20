import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { TopBar } from "../components/common/TopBar";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

type Tab = "friends" | "pending" | "search";

type Friend = {
  id: number;
  name: string;
  avatarUrl?: string;
};

type PendingRequest = {
  id: number;
  fullName: string;
  avatarUrl: string | null;
};

type SearchUser = {
  id: number;
  fullName: string;
  username?: string;
  avatarUrl?: string;
};

interface FriendsScreenProps {
  user: AuthUser;
  onMessageFriend?: (userId: number) => void;
  onOpenUserProfile?: (userId: number) => void;
}

function SmallAvatar({
  name,
  avatarUrl,
  size = 48,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hasAvatar = Boolean(String(avatarUrl || "").trim());

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#0052ce",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {hasAvatar ? (
        <Image
          source={{ uri: String(avatarUrl) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.34 }}>
          {initials || "U"}
        </Text>
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  count,
  onPress,
}: {
  label: string;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: active ? "#0052ce" : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: active ? "#0052ce" : "#6b7280",
          }}
        >
          {label}
        </Text>
        {count && count > 0 ? (
          <View
            style={{
              backgroundColor: "#ef4444",
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{count}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function FriendsScreen({
  user,
  onMessageFriend,
  onOpenUserProfile,
}: FriendsScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const setLoading = (id: number, value: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: value }));
  };

  const loadFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const res = await api.listFriends();
      setFriends((res.friends || []).map((item) => ({
        id: item.id,
        name: item.name,
        avatarUrl: item.avatarUrl,
      })));
    } catch {
      setFriends([]);
    } finally {
      setIsLoadingFriends(false);
      setRefreshing(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const res = await api.listPendingFriendRequests();
      setPendingRequests(Array.isArray(res) ? res : []);
    } catch {
      setPendingRequests([]);
    } finally {
      setIsLoadingPending(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();
    void loadPending();
  }, [loadFriends, loadPending]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === "friends") {
      void loadFriends();
      return;
    }
    if (activeTab === "pending") {
      void loadPending();
      return;
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (activeTab !== "search") return;
    const query = searchKeyword.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchUsers(query);
        const mapped = (res.users || [])
          .filter((item) => item.id !== user.id)
          .slice(0, 20)
          .map((item) => ({
            id: item.id,
            fullName: item.fullName || "Người dùng",
            username: item.email || item.phone || undefined,
            avatarUrl: item.avatarUrl || undefined,
          }));
        setSearchResults(mapped);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [activeTab, searchKeyword, user.id]);

  const acceptedFriendIds = useMemo(() => new Set(friends.map((item) => item.id)), [friends]);

  const handleSendRequest = async (targetId: number, name: string) => {
    setLoading(targetId, true);
    try {
      await api.sendFriendRequest(targetId);
      Alert.alert("Đã gửi", `Đã gửi lời mời kết bạn đến ${name}`);
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể gửi lời mời");
    } finally {
      setLoading(targetId, false);
    }
  };

  const handleAccept = async (requesterUserId: number) => {
    setLoading(requesterUserId, true);
    try {
      await api.acceptFriendRequest(requesterUserId);
      setPendingRequests((prev) => prev.filter((item) => item.id !== requesterUserId));
      await loadFriends();
      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn");
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể chấp nhận");
    } finally {
      setLoading(requesterUserId, false);
    }
  };

  const handleReject = async (requesterUserId: number) => {
    setLoading(requesterUserId, true);
    try {
      await api.rejectFriendRequest(requesterUserId);
      setPendingRequests((prev) => prev.filter((item) => item.id !== requesterUserId));
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể từ chối");
    } finally {
      setLoading(requesterUserId, false);
    }
  };

  const handleRemoveFriend = (friendId: number, name: string) => {
    Alert.alert("Xóa bạn bè", `Bạn có muốn hủy kết bạn với ${name}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setLoading(friendId, true);
          try {
            await api.removeFriend(friendId);
            setFriends((prev) => prev.filter((item) => item.id !== friendId));
          } catch (err) {
            Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể xóa");
          } finally {
            setLoading(friendId, false);
          }
        },
      },
    ]);
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
      }}
    >
      <TouchableOpacity
        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
        activeOpacity={0.75}
        onPress={() => onOpenUserProfile?.(item.id)}
      >
        <SmallAvatar name={item.name} avatarUrl={item.avatarUrl} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{item.name}</Text>
          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Bạn bè</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onMessageFriend?.(item.id)}
        disabled={actionLoading[item.id] || !onMessageFriend}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 8,
          backgroundColor: "#0052ce",
          marginRight: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>Nhắn tin</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(item.id, item.name)}
        disabled={actionLoading[item.id]}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#d1d5db",
          backgroundColor: "#f9fafb",
        }}
      >
        {actionLoading[item.id] ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={{ fontSize: 12, color: "#374151", fontWeight: "600" }}>Hủy kết bạn</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPending = ({ item }: { item: PendingRequest }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
      }}
    >
      <TouchableOpacity
        style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
        activeOpacity={0.75}
        onPress={() => onOpenUserProfile?.(item.id)}
      >
        <SmallAvatar name={item.fullName} avatarUrl={item.avatarUrl} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{item.fullName}</Text>
          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Đang chờ bạn xác nhận</Text>
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <TouchableOpacity
          onPress={() => handleAccept(item.id)}
          disabled={actionLoading[item.id]}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: "#0052ce",
          }}
        >
          {actionLoading[item.id] ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>Chấp nhận</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleReject(item.id)}
          disabled={actionLoading[item.id]}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#d1d5db",
            backgroundColor: "#f9fafb",
          }}
        >
          <Text style={{ fontSize: 12, color: "#374151", fontWeight: "600" }}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchUser = ({ item }: { item: SearchUser }) => {
    const isFriend = acceptedFriendIds.has(item.id);
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <TouchableOpacity
          style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
          activeOpacity={0.75}
          onPress={() => onOpenUserProfile?.(item.id)}
        >
          <SmallAvatar name={item.fullName} avatarUrl={item.avatarUrl} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{item.fullName}</Text>
            {item.username ? (
              <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{item.username}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {isFriend ? (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: "#dcfce7",
            }}
          >
            <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600" }}>Bạn bè</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleSendRequest(item.id, item.fullName)}
            disabled={actionLoading[item.id]}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: "#0052ce",
            }}
          >
            {actionLoading[item.id] ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>+ Kết bạn</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <TopBar title="Bạn bè" />

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        }}
      >
        <TabButton
          label="Bạn bè"
          count={friends.length}
          active={activeTab === "friends"}
          onPress={() => setActiveTab("friends")}
        />
        <TabButton
          label="Lời mời"
          count={pendingRequests.length}
          active={activeTab === "pending"}
          onPress={() => setActiveTab("pending")}
        />
        <TabButton
          label="Tìm bạn"
          active={activeTab === "search"}
          onPress={() => setActiveTab("search")}
        />
      </View>

      {activeTab === "search" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderBottomColor: "#e5e7eb",
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={{
              flex: 1,
              height: 40,
              backgroundColor: "#f3f4f6",
              borderRadius: 20,
              paddingHorizontal: 14,
              fontSize: 14,
              color: "#111827",
            }}
            placeholder="Tìm theo tên hoặc email..."
            placeholderTextColor="#9ca3af"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            autoFocus
          />
          {searchKeyword.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchKeyword("")} style={{ marginLeft: 8 }}>
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {activeTab === "friends" ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderFriend}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0052ce" />
          }
          ListEmptyComponent={
            isLoadingFriends ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <ActivityIndicator size="large" color="#0052ce" />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 }}>
                  Chưa có bạn bè nào
                </Text>
                <Text style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                  Chuyển sang tab Tìm bạn để kết nối thêm bạn mới.
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : null}

      {activeTab === "pending" ? (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPending}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0052ce" />
          }
          ListEmptyComponent={
            isLoadingPending ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <ActivityIndicator size="large" color="#0052ce" />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>📬</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 }}>
                  Không có lời mời nào
                </Text>
                <Text style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                  Khi có người gửi lời mời kết bạn, chúng sẽ hiển thị ở đây.
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : null}

      {activeTab === "search" ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSearchUser}
          ListHeaderComponent={
            isSearching ? (
              <View style={{ alignItems: "center", paddingTop: 20 }}>
                <ActivityIndicator size="small" color="#0052ce" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !isSearching ? (
              <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 }}>
                  {searchKeyword.length >= 2 ? "Không tìm thấy người dùng" : "Tìm kiếm bạn bè"}
                </Text>
                <Text style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                  {searchKeyword.length >= 2
                    ? "Thử lại với từ khóa khác"
                    : "Nhập ít nhất 2 ký tự để tìm bạn"}
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : null}
    </View>
  );
}

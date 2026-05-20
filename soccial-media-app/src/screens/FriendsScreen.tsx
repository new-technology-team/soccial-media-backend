import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { TopBar } from "../components/common/TopBar";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

// ---- Types ----
interface Friend {
  id: number;
  name: string;
  avatarUrl?: string;
}

interface PendingRequest {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

interface SearchUser {
  id: number;
  full_name?: string;
  username?: string;
  avatar_url?: string;
}

type Tab = "friends" | "pending" | "search";

// ---- Avatar nhỏ ----
function SmallAvatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  const hasUrl = Boolean(String(url || "").trim());
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      {hasUrl ? (
        <Image
          source={{ uri: String(url) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.33 }}>{initials}</Text>
      )}
    </View>
  );
}

// ---- Tab Button ----
function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: active ? "#0052ce" : "transparent",
      }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: active ? "#0052ce" : "#6b7280",
          }}
        >
          {label}
        </Text>
        {count !== undefined && count > 0 && (
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
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---- FriendsScreen ----
interface FriendsScreenProps {
  user: AuthUser;
}

export function FriendsScreen({ user }: FriendsScreenProps) {
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

  // ---- Load friends ----
  const loadFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const res = await api.listFriends();
      setFriends(res.friends || []);
    } catch {
      /* ignore */
    } finally {
      setIsLoadingFriends(false);
      setRefreshing(false);
    }
  }, []);

  // ---- Load pending requests ----
  const loadPending = useCallback(async () => {
    setIsLoadingPending(true);
    try {
      const res = await api.listPendingFriendRequests();
      const list = Array.isArray(res) ? res : [];
      setPendingRequests(list);
    } catch {
      /* ignore */
    } finally {
      setIsLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadPending();
  }, [loadFriends, loadPending]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === "friends") loadFriends();
    else if (activeTab === "pending") loadPending();
    else setRefreshing(false);
  };

  // ---- Search ----
  useEffect(() => {
    if (activeTab !== "search") return;
    if (searchKeyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchUsers(searchKeyword.trim());
        const filtered = (res.users || []).filter((u: any) => u.id !== user.id);
        setSearchResults(filtered.slice(0, 20));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchKeyword, activeTab, user.id]);

  // ---- Thao tác ----
  const setLoading = (id: number, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [id]: val }));

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
      setPendingRequests((prev) => prev.filter((p) => p.id !== requesterUserId));
      await loadFriends();
      Alert.alert("Thành công", "Đã chấp nhận lời mời kết bạn 🎉");
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
      setPendingRequests((prev) => prev.filter((p) => p.id !== requesterUserId));
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
            setFriends((prev) => prev.filter((f) => f.id !== friendId));
          } catch (err) {
            Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể xóa");
          } finally {
            setLoading(friendId, false);
          }
        },
      },
    ]);
  };

  // ---- Render: Friends tab ----
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
      <SmallAvatar name={item.name} url={item.avatarUrl} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{item.name}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Bạn bè</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(item.id, item.name)}
        disabled={actionLoading[item.id]}
        style={{
          paddingHorizontal: 14,
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

  // ---- Render: Pending tab ----
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
      <SmallAvatar name={item.fullName} url={item.avatarUrl} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{item.fullName}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Muốn kết bạn với bạn</Text>
      </View>
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

  // ---- Render: Search tab ----
  const renderSearchUser = ({ item }: { item: SearchUser }) => {
    const name = item.full_name || item.username || "Người dùng";
    const isFriend = friends.some((f) => f.id === item.id);
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
        <SmallAvatar name={name} url={(item as any).avatar_url} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{name}</Text>
          {item.username ? (
            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>@{item.username}</Text>
          ) : null}
        </View>
        {isFriend ? (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: "#dcfce7",
            }}
          >
            <Text style={{ fontSize: 12, color: "#16a34a", fontWeight: "600" }}>Bạn bè ✓</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleSendRequest(item.id, name)}
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

  // ---- Render ----
  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <TopBar title="Bạn bè" />

      {/* Tab Bar */}
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

      {/* Search Bar (chỉ hiện khi tab search) */}
      {activeTab === "search" && (
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
          {searchKeyword.length > 0 && (
            <TouchableOpacity onPress={() => setSearchKeyword("")} style={{ marginLeft: 8 }}>
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Nội dung tab */}
      {activeTab === "friends" && (
        <FlatList
          data={friends}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderFriend}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0052ce" />}
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
                  Chuyển sang tab "Tìm bạn" để thêm bạn mới nhé!
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {activeTab === "pending" && (
        <FlatList
          data={pendingRequests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPending}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0052ce" />}
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
                  Khi ai đó gửi lời mời kết bạn, nó sẽ hiện ở đây.
                </Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {activeTab === "search" && (
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
                    ? "Thử tìm bằng từ khóa khác"
                    : "Nhập tên hoặc email để tìm bạn"}
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

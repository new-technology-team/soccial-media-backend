import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { TopBar } from "../components/common/TopBar";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import { Avatar } from "../components/common/Avatar";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

interface ProfileScreenProps {
  user: AuthUser;
  onLogout: () => void;
  onUserUpdated?: (user: AuthUser) => void;
}

export function ProfileScreen({
  user,
  onLogout,
  onUserUpdated,
}: ProfileScreenProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || "");
  const [gender, setGender] = useState(user.gender || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.avatarUrl || null,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setFullName(user.fullName);
    setDateOfBirth(user.dateOfBirth || "");
    setGender(user.gender || "");
    setAvatarUrl(user.avatarUrl || null);
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatus("");
    try {
      const res = await api.updateProfile({
        fullName: fullName || undefined,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
      });
      setStatus("Cập nhật hồ sơ thành công!");
      onUserUpdated?.(res.user);
      setFullName(res.user.fullName);
      setDateOfBirth(res.user.dateOfBirth || "");
      setGender(res.user.gender || "");
      setAvatarUrl(res.user.avatarUrl || null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeAvatar = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Thiếu quyền truy cập",
          "Vui lòng cho phép ứng dụng truy cập thư viện ảnh.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Upload thất bại", "Không đọc được dữ liệu ảnh.");
        return;
      }

      setIsUploadingAvatar(true);
      setStatus("");

      const uploaded = await api.uploadAvatarBase64({
        fileName: asset.fileName || `avatar-${Date.now()}.jpg`,
        contentType: asset.mimeType || "image/jpeg",
        base64Data: asset.base64,
      });

      if (!uploaded.fileUrl) {
        throw new Error("Không nhận được URL avatar từ server");
      }

      const res = await api.updateProfile({ avatarUrl: uploaded.fileUrl });
      onUserUpdated?.(res.user);
      setAvatarUrl(res.user.avatarUrl || uploaded.fileUrl);
      setStatus("Cập nhật ảnh đại diện thành công!");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload avatar thất bại");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setStatus("Vui lòng nhập đầy đủ");
      return;
    }
    setIsSaving(true);
    setStatus("");
    try {
      await api.changePassword({ currentPassword, newPassword });
      setStatus("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <TopBar title="Hồ sơ" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Avatar */}
        <View className="items-center mb-6">
          <Avatar
            name={fullName || user.fullName}
            avatarUrl={avatarUrl}
            size="lg"
          />
          <Text className="mt-3 text-lg font-bold text-foreground">
            {fullName || user.fullName}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {user.email || user.phone}
          </Text>
          <TouchableOpacity
            className="mt-2 rounded-full border border-border bg-surface-secondary px-3 py-1.5"
            onPress={() => {
              void handleChangeAvatar();
            }}
            disabled={isUploadingAvatar}
          >
            <View className="flex-row items-center">
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#0052ce" />
              ) : null}
              <Text className="text-primary font-semibold text-xs ml-1">
                {isUploadingAvatar ? "Đang upload..." : "Đổi ảnh đại diện"}
              </Text>
            </View>
          </TouchableOpacity>
          {user.role && user.role !== "user" && (
            <View className="bg-blue-50 rounded-full px-3 py-1 mt-2">
              <Text className="text-primary font-bold text-xs uppercase">
                {user.role}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <Card style={{ marginBottom: 12 }}>
          <Text className="text-base font-bold text-foreground mb-4">
            Thông tin cá nhân
          </Text>
          <Input
            label="Họ và tên"
            placeholder="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
          />
          <Input
            label="Ngày sinh"
            placeholder="YYYY-MM-DD"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />
          <Input
            label="Giới tính"
            placeholder="Nam / Nữ / Khác"
            value={gender}
            onChangeText={setGender}
          />
          <Button
            title={isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            onPress={handleSave}
            loading={isSaving}
          />
        </Card>

        {/* Change Password */}
        <Card>
          <Text className="text-base font-bold text-foreground mb-4">
            Đổi mật khẩu
          </Text>
          <Input
            label="Mật khẩu hiện tại"
            placeholder="••••••••"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Input
            label="Mật khẩu mới"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Button
            title="Đổi mật khẩu"
            onPress={handleChangePassword}
            variant="secondary"
            disabled={isSaving}
          />
        </Card>

        {/* Status */}
        {status ? (
          <View
            className={`mt-3 rounded-xl px-4 py-3 border ${
              status.includes("thành công")
                ? "bg-green-50 border-[#bbf7d0]"
                : "bg-red-50 border-[#fecaca]"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                status.includes("thành công") ? "text-success" : "text-danger"
              }`}
            >
              {status}
            </Text>
          </View>
        ) : null}

        {/* Logout */}
        <TouchableOpacity
          className="mt-8 px-4 py-4 items-center"
          onPress={onLogout}
        >
          <Text className="text-danger font-bold text-base">Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

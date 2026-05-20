import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import "./src/global.css";
import { AuthScreen } from "./src/screens/AuthScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { AIChatScreen } from "./src/screens/AIChatScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { Loading } from "./src/components/common/Loading";
import { api, authStore, getSocket, disconnectSocket } from "./src/lib";
import type { AuthUser } from "./src/types";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState("feed");
  const [feedFocusPostId, setFeedFocusPostId] = useState<string | null>(null);
  const [feedOpenCommentsPostId, setFeedOpenCommentsPostId] = useState<
    string | null
  >(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    authStore.hydrate().then(() => {
      const tokens = authStore.getTokens();
      if (tokens?.accessToken) {
        api
          .me()
          .then((me) => setUser(me))
          .catch(() => {
            void authStore.clear();
            disconnectSocket();
            setUser(null);
          });
      }
      setIsRestoring(false);
    });
  }, []);

  const handleLogin = useCallback((loggedInUser: AuthUser) => {
    disconnectSocket();
    setUser(loggedInUser);
    setActiveTab("feed");
    const token = authStore.getTokens()?.accessToken || "";
    getSocket(token, () => console.log("Socket connected"));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    authStore.clear();
    disconnectSocket();
    setUser(null);
    setActiveTab("feed");
  }, []);

  const openPostInFeed = useCallback(
    (postId: string, options?: { openComments?: boolean }) => {
      setFeedFocusPostId(postId);
      setFeedOpenCommentsPostId(options?.openComments ? postId : null);
      setActiveTab("feed");
    },
    [],
  );

  const handleFeedRouteConsumed = useCallback(() => {
    setFeedFocusPostId(null);
    setFeedOpenCommentsPostId(null);
  }, []);

  if (isRestoring) {
    return <Loading message="Đang khôi phục phiên..." />;
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "feed":
        return (
          <FeedScreen
            user={user}
            onLogout={handleLogout}
            focusPostId={feedFocusPostId}
            openCommentsPostId={feedOpenCommentsPostId}
            onRouteConsumed={handleFeedRouteConsumed}
          />
        );
      case "search":
        return <SearchScreen onOpenPost={openPostInFeed} />;
      case "messages":
        return <MessagesScreen user={user} />;
      case "friends":
        return <FriendsScreen user={user} />;
      case "ai-chat":
        return <AIChatScreen />;
      case "notifications":
        return <NotificationsScreen onOpenPost={openPostInFeed} />;
      case "profile":
        return (
          <ProfileScreen
            user={user}
            onLogout={handleLogout}
            onUserUpdated={(nextUser) => setUser(nextUser)}
          />
        );
      default:
        return (
          <FeedScreen
            user={user}
            onLogout={handleLogout}
            focusPostId={feedFocusPostId}
            openCommentsPostId={feedOpenCommentsPostId}
            onRouteConsumed={handleFeedRouteConsumed}
          />
        );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 bg-background">
        <StatusBar />
        {renderScreen()}
        <AppNavigator activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </TouchableWithoutFeedback>
  );
}

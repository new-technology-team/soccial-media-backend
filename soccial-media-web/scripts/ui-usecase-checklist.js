const base = "http://127.0.0.1:5000/api";
const password = "Seed@123456";

async function call(path, opts = {}, token) {
  const res = await fetch(base + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function pushCase(target, name, pass, status, details) {
  target.push({ name, pass, status, details: details || "" });
}

(async () => {
  const report = {
    guest: [],
    user: [],
    moderator: [],
    admin: [],
  };

  const guestFeed = await call("/social/feed", { method: "GET" });
  pushCase(
    report.guest,
    "Xem bảng tin công khai",
    guestFeed.ok && Array.isArray(guestFeed.data.posts),
    guestFeed.status,
    `posts=${(guestFeed.data.posts || []).length}`,
  );

  const guestExplore = await call("/social/feed?limit=6", { method: "GET" });
  pushCase(report.guest, "Xem khám phá", guestExplore.ok, guestExplore.status);

  const guestAi = await call("/social/ai/support", {
    method: "POST",
    body: JSON.stringify({ message: "/search zchat" }),
  });
  pushCase(
    report.guest,
    "Chat AI",
    guestAi.ok && Boolean(guestAi.data.reply),
    guestAi.status,
  );

  const guestCreatePost = await call("/social/posts", {
    method: "POST",
    body: JSON.stringify({ content: "guest cannot post" }),
  });
  pushCase(
    report.guest,
    "Bị chặn đăng bài",
    guestCreatePost.status === 401,
    guestCreatePost.status,
  );

  const loginUser = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ emailOrPhone: "an.nguyen@zchat.local", password }),
  });
  const loginMod = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ emailOrPhone: "moderator@zchat.local", password }),
  });
  const loginAdmin = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ emailOrPhone: "admin@zchat.local", password }),
  });

  pushCase(report.user, "Đăng nhập user", loginUser.ok, loginUser.status);
  pushCase(
    report.moderator,
    "Đăng nhập moderator",
    loginMod.ok,
    loginMod.status,
  );
  pushCase(report.admin, "Đăng nhập admin", loginAdmin.ok, loginAdmin.status);

  const userToken = loginUser.data.accessToken;
  const modToken = loginMod.data.accessToken;
  const adminToken = loginAdmin.data.accessToken;

  const userCreatePost = await call(
    "/social/posts",
    {
      method: "POST",
      body: JSON.stringify({
        content: `Manual checklist post ${Date.now()} #checklist`,
        visibility: "public",
      }),
    },
    userToken,
  );
  const postId = userCreatePost.data?.post?.id;
  pushCase(
    report.user,
    "Đăng bài viết",
    userCreatePost.ok && Boolean(postId),
    userCreatePost.status,
    `postId=${postId || "n/a"}`,
  );

  const userComment = await call(
    `/social/posts/${postId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content: "Checklist comment from user role" }),
    },
    userToken,
  );
  pushCase(
    report.user,
    "Bình luận bài viết",
    userComment.ok,
    userComment.status,
  );

  const userReact = await call(
    `/social/posts/${postId}/reaction`,
    {
      method: "POST",
      body: JSON.stringify({ type: "like" }),
    },
    userToken,
  );
  pushCase(report.user, "Tương tác bài viết", userReact.ok, userReact.status);

  const userAi = await call(
    "/social/ai/support",
    {
      method: "POST",
      body: JSON.stringify({ message: "/translate en: xin chào" }),
    },
    userToken,
  );
  pushCase(
    report.user,
    "Chat AI",
    userAi.ok && Boolean(userAi.data.reply),
    userAi.status,
  );

  const userAdminStats = await call(
    "/social/admin/stats",
    { method: "GET" },
    userToken,
  );
  pushCase(
    report.user,
    "User bị chặn thống kê admin",
    userAdminStats.status === 403,
    userAdminStats.status,
  );

  const modReports = await call(
    "/social/moderation/reports",
    { method: "GET" },
    modToken,
  );
  pushCase(
    report.moderator,
    "Xem báo cáo kiểm duyệt",
    modReports.ok,
    modReports.status,
    `reports=${(modReports.data.reports || []).length}`,
  );

  const modHidePost = await call(
    `/social/moderation/posts/${postId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "hidden",
        resolutionNote: "manual role test",
      }),
    },
    modToken,
  );
  pushCase(report.moderator, "Ẩn bài viết", modHidePost.ok, modHidePost.status);

  const modAdminStats = await call(
    "/social/admin/stats",
    { method: "GET" },
    modToken,
  );
  pushCase(
    report.moderator,
    "Moderator bị chặn thống kê admin",
    modAdminStats.status === 403,
    modAdminStats.status,
  );

  const adminStats = await call(
    "/social/admin/stats",
    { method: "GET" },
    adminToken,
  );
  pushCase(
    report.admin,
    "Xem thống kê hệ thống",
    adminStats.ok,
    adminStats.status,
  );

  const adminUsers = await call(
    "/social/admin/users",
    { method: "GET" },
    adminToken,
  );
  pushCase(
    report.admin,
    "Xem danh sách người dùng",
    adminUsers.ok,
    adminUsers.status,
    `users=${(adminUsers.data.users || []).length}`,
  );

  const targetUserId = loginUser.data?.user?.id;
  const adminPromote = await call(
    `/social/admin/users/${targetUserId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ role: "moderator" }),
    },
    adminToken,
  );
  pushCase(
    report.admin,
    "Cập nhật vai trò người dùng",
    adminPromote.ok,
    adminPromote.status,
  );

  const chatDirect = await call(
    "/chat/conversations/direct",
    {
      method: "POST",
      body: JSON.stringify({ userId: loginMod.data?.user?.id }),
    },
    userToken,
  );
  const conversationId = chatDirect.data?.conversation?.id;
  pushCase(
    report.user,
    "Tạo hội thoại direct",
    chatDirect.ok && Boolean(conversationId),
    chatDirect.status,
    `conversationId=${conversationId || "n/a"}`,
  );

  const chatSend = await call(
    `/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ type: "text", text: "Checklist message" }),
    },
    userToken,
  );
  pushCase(report.user, "Gửi tin nhắn", chatSend.ok, chatSend.status);

  const flat = [
    ...report.guest,
    ...report.user,
    ...report.moderator,
    ...report.admin,
  ];
  const summary = {
    total: flat.length,
    pass: flat.filter((item) => item.pass).length,
    fail: flat.filter((item) => !item.pass).length,
  };

  console.log(JSON.stringify({ summary, report }, null, 2));
})();

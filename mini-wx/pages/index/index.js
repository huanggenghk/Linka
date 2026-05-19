const API_BASE_KEY = "linka_api_base_url_local";
const MOCK_USER_KEY = "linka_mock_wechat_user_id";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_MOCK_USER_ID = "wx-demo-user";

let pollTimer;

Page({
  data: {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    mockWechatUserId: DEFAULT_MOCK_USER_ID,
    status: "unbound",
    bindingCode: "",
    expiresAt: "",
    copyPrompt: "",
    agentPlatform: "",
    agentName: "",
    boundAt: "",
    loading: false,
    error: "",
  },

  onLoad() {
    const apiBaseUrl = readStringStorage(API_BASE_KEY, DEFAULT_API_BASE_URL);
    const mockWechatUserId = readStringStorage(MOCK_USER_KEY, DEFAULT_MOCK_USER_ID);
    this.setData({ apiBaseUrl, mockWechatUserId });
    this.refreshStatus();
  },

  onShow() {
    if (this.data.status === "pending") startPolling(this);
  },

  onHide() {
    stopPolling();
  },

  onUnload() {
    stopPolling();
  },

  onApiBaseInput(event) {
    const value = event.detail.value.trim();
    wx.setStorageSync(API_BASE_KEY, value);
    this.setData({ apiBaseUrl: value });
  },

  onMockUserInput(event) {
    const value = event.detail.value.trim();
    wx.setStorageSync(MOCK_USER_KEY, value);
    this.setData({ mockWechatUserId: value });
  },

  async refreshStatus() {
    await withLoading(this, async () => {
      const current = await request(this, "/api/agent-bindings/current");
      applyBindingState(this, current);
    });
  },

  async createBinding() {
    await withLoading(this, async () => {
      const session = await request(this, "/api/agent-bindings/sessions", "POST");

      applyBindingState(this, {
        status: "pending",
        binding_code: session.binding_code,
        expires_at: session.expires_at,
        copy_prompt: session.copy_prompt,
      });

      copyText(session.copy_prompt, "绑定文案已复制");
    });
  },

  copyPrompt() {
    if (!this.data.copyPrompt) return;
    copyText(this.data.copyPrompt, "绑定文案已复制");
  },

  unbind() {
    wx.showModal({
      title: "解除绑定",
      content: "解除后，当前 Agent token 会失效。",
      confirmText: "解除",
      success: async (res) => {
        if (!res.confirm) return;
        await withLoading(this, async () => {
          await request(this, "/api/agent-bindings/current", "DELETE");
          applyBindingState(this, { status: "unbound" });
        });
      },
    });
  },
});

function applyBindingState(page, current) {
  if (current.status === "bound") {
    stopPolling();
    page.setData({
      status: "bound",
      bindingCode: "",
      expiresAt: "",
      copyPrompt: "",
      agentPlatform: current.agent_platform,
      agentName: current.agent_name,
      boundAt: current.bound_at,
      error: "",
    });
    return;
  }

  if (current.status === "pending") {
    page.setData({
      status: "pending",
      bindingCode: current.binding_code,
      expiresAt: current.expires_at,
      copyPrompt: current.copy_prompt,
      agentPlatform: "",
      agentName: "",
      boundAt: "",
      error: "",
    });
    startPolling(page);
    return;
  }

  stopPolling();
  page.setData({
    status: "unbound",
    bindingCode: "",
    expiresAt: "",
    copyPrompt: "",
    agentPlatform: "",
    agentName: "",
    boundAt: "",
    error: "",
  });
}

function startPolling(page) {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const current = await request(page, "/api/agent-bindings/current");
      applyBindingState(page, current);
    } catch {
      // Keep polling; transient local-network failures are common in dev tools.
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

async function withLoading(page, action) {
  page.setData({ loading: true, error: "" });
  try {
    await action();
  } catch (error) {
    page.setData({
      error: error instanceof Error ? error.message : "请求失败",
    });
  } finally {
    page.setData({ loading: false });
  }
}

function request(page, path, method = "GET") {
  const baseUrl = page.data.apiBaseUrl.replace(/\/$/, "");
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      header: {
        "Content-Type": "application/json",
        "X-Mock-Wechat-User-Id": page.data.mockWechatUserId,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const data = res.data || {};
        reject(new Error(data.error || `请求失败：${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || "网络请求失败")),
    });
  });
}

function copyText(text, title) {
  wx.setClipboardData({
    data: text,
    success: () => wx.showToast({ title, icon: "success" }),
    fail: () => wx.showToast({ title: "复制失败", icon: "none" }),
  });
}

function readStringStorage(key, fallback) {
  const value = wx.getStorageSync(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

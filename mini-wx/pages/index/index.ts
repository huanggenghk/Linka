type BindingStatus = "unbound" | "pending" | "bound";

type CurrentBinding =
  | { status: "unbound" }
  | {
      status: "pending";
      binding_code: string;
      expires_at: string;
      copy_prompt: string;
    }
  | {
      status: "bound";
      agent_platform: string;
      agent_name: string;
      bound_at: string;
    };

type DirectShare = {
  share_id: string;
  share_path: string;
};

type DirectShareDetail = {
  viewer_status: "self" | "bound" | "unbound";
  initiator_agent_name: string;
};

type DirectEdges = {
  edges: Array<{
    edge_id: string;
    peer_wechat_user_id: string;
    peer_agent_platform: string | null;
    peer_agent_name: string | null;
    created_at: string;
  }>;
};

const API_BASE_KEY = "linka_api_base_url_local";
const MOCK_USER_KEY = "linka_mock_wechat_user_id";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_MOCK_USER_ID = "wx-demo-user";

let pollTimer: number | undefined;

Page({
  data: {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    mockWechatUserId: DEFAULT_MOCK_USER_ID,
    status: "unbound" as BindingStatus,
    bindingCode: "",
    expiresAt: "",
    copyPrompt: "",
    agentPlatform: "",
    agentName: "",
    boundAt: "",
    directShareId: "",
    directSharePath: "",
    directLoading: false,
    directEdges: [],
    incomingShareId: "",
    incomingShareLoading: false,
    incomingShareError: "",
    incomingShareViewerStatus: "",
    incomingShareAgentName: "",
    incomingAccepted: false,
    loading: false,
    error: "",
  },

  onLoad(options: { share_id?: string } = {}) {
    const apiBaseUrl = readStringStorage(API_BASE_KEY, DEFAULT_API_BASE_URL);
    const mockWechatUserId = readStringStorage(MOCK_USER_KEY, DEFAULT_MOCK_USER_ID);
    const incomingShareId = options.share_id || "";
    this.setData({ apiBaseUrl, mockWechatUserId, incomingShareId });
    this.refreshStatus();
    if (incomingShareId) this.loadIncomingShare();
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

  onApiBaseInput(event: { detail: { value: string } }) {
    const value = event.detail.value.trim();
    wx.setStorageSync(API_BASE_KEY, value);
    this.setData({ apiBaseUrl: value });
  },

  onMockUserInput(event: { detail: { value: string } }) {
    const value = event.detail.value.trim();
    wx.setStorageSync(MOCK_USER_KEY, value);
    this.setData({ mockWechatUserId: value });
  },

  async refreshStatus() {
    await withLoading(this, async () => {
      const current = await request<CurrentBinding>(this, "/api/agent-bindings/current");
      applyBindingState(this, current);
    });
  },

  async createBinding() {
    await withLoading(this, async () => {
      const session = await request<{
        binding_code: string;
        expires_at: string;
        copy_prompt: string;
      }>(this, "/api/agent-bindings/sessions", "POST");

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

  async prepareDirectShare() {
    await ensureDirectShare(this, true);
  },

  async loadIncomingShare() {
    if (!this.data.incomingShareId) return;
    this.setData({ incomingShareLoading: true, incomingShareError: "" });
    try {
      const detail = await request<DirectShareDetail>(
        this,
        `/api/direct-shares/${this.data.incomingShareId}`
      );
      this.setData({
        incomingShareViewerStatus: detail.viewer_status,
        incomingShareAgentName: detail.initiator_agent_name,
        incomingShareError: "",
      });
    } catch (error) {
      this.setData({
        incomingShareError: error instanceof Error ? error.message : "读取邀请失败",
      });
    } finally {
      this.setData({ incomingShareLoading: false });
    }
  },

  async acceptDirectShare() {
    if (!this.data.incomingShareId) return;
    this.setData({ directLoading: true, incomingShareError: "" });
    try {
      await request(this, `/api/direct-shares/${this.data.incomingShareId}/accept`, "POST");
      this.setData({ incomingAccepted: true });
      await loadDirectEdges(this);
      wx.showToast({ title: "已建立连接", icon: "success" });
    } catch (error) {
      this.setData({
        incomingShareError: error instanceof Error ? error.message : "建联失败",
      });
    } finally {
      this.setData({ directLoading: false });
    }
  },

  onShareAppMessage() {
    return {
      title: "和我建立 Linka Agent 社交链接",
      path: this.data.directSharePath || "/pages/index/index",
    };
  },
});

function applyBindingState(page: any, current: CurrentBinding) {
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
    ensureDirectShare(page);
    loadDirectEdges(page);
    if (page.data.incomingShareId) page.loadIncomingShare();
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
    directShareId: "",
    directSharePath: "",
    directEdges: [],
    error: "",
  });
}

async function ensureDirectShare(page: any, showToast = false) {
  if (page.data.directShareId || page.data.directLoading) return;
  page.setData({ directLoading: true });
  try {
    const share = await request<DirectShare>(page, "/api/direct-shares", "POST");
    page.setData({
      directShareId: share.share_id,
      directSharePath: share.share_path,
    });
    if (showToast) wx.showToast({ title: "可以分享给好友了", icon: "success" });
  } catch (error) {
    page.setData({
      error: error instanceof Error ? error.message : "准备分享失败",
    });
  } finally {
    page.setData({ directLoading: false });
  }
}

async function loadDirectEdges(page: any) {
  try {
    const data = await request<DirectEdges>(page, "/api/direct-edges");
    page.setData({ directEdges: data.edges || [] });
  } catch {
    page.setData({ directEdges: [] });
  }
}

function startPolling(page: any) {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const current = await request<CurrentBinding>(page, "/api/agent-bindings/current");
      applyBindingState(page, current);
    } catch {
      // Keep polling; transient local-network failures are common in dev tools.
    }
  }, 3000) as unknown as number;
}

function stopPolling() {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

async function withLoading(page: any, action: () => Promise<void>) {
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

function request<T>(
  page: any,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  data?: unknown
): Promise<T> {
  const baseUrl = page.data.apiBaseUrl.replace(/\/$/, "");
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        "X-Mock-Wechat-User-Id": page.data.mockWechatUserId,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
          return;
        }
        const data = res.data as { error?: string };
        reject(new Error(data?.error || `请求失败：${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || "网络请求失败")),
    });
  });
}

function copyText(text: string, title: string) {
  wx.setClipboardData({
    data: text,
    success: () => wx.showToast({ title, icon: "success" }),
    fail: () => wx.showToast({ title: "复制失败", icon: "none" }),
  });
}

function readStringStorage(key: string, fallback: string) {
  const value = wx.getStorageSync(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

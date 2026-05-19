"use strict";
const API_BASE_KEY = "linka_api_base_url_local";
const SESSION_TOKEN_KEY = "linka_wechat_session_token";
const SESSION_EXPIRES_KEY = "linka_wechat_session_expires_at";
const DEFAULT_API_BASE_URL = "https://linka.zone";
let pollTimer;
Page({
    data: {
        apiBaseUrl: DEFAULT_API_BASE_URL,
        sessionToken: "",
        sessionExpiresAt: "",
        status: "unbound",
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
        authLoading: false,
        loading: false,
        error: "",
    },
    onLoad(options = {}) {
        const apiBaseUrl = readStringStorage(API_BASE_KEY, DEFAULT_API_BASE_URL);
        const sessionToken = readStringStorage(SESSION_TOKEN_KEY, "");
        const sessionExpiresAt = readStringStorage(SESSION_EXPIRES_KEY, "");
        const incomingShareId = options.share_id || "";
        this.setData({ apiBaseUrl, sessionToken, sessionExpiresAt, incomingShareId });
        this.bootstrap();
    },
    onShow() {
        if (this.data.status === "pending")
            startPolling(this);
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
        clearWechatSession(this);
        this.setData({ apiBaseUrl: value });
    },
    async bootstrap() {
        try {
            await ensureWechatLogin(this);
            await this.refreshStatus();
            if (this.data.incomingShareId)
                await this.loadIncomingShare();
        }
        catch (error) {
            this.setData({
                error: error instanceof Error ? error.message : "微信登录失败",
            });
        }
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
        if (!this.data.copyPrompt)
            return;
        copyText(this.data.copyPrompt, "绑定文案已复制");
    },
    unbind() {
        wx.showModal({
            title: "解除绑定",
            content: "解除后，当前 Agent token 会失效。",
            confirmText: "解除",
            success: async (res) => {
                if (!res.confirm)
                    return;
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
        if (!this.data.incomingShareId)
            return;
        this.setData({ incomingShareLoading: true, incomingShareError: "" });
        try {
            const detail = await request(this, `/api/direct-shares/${this.data.incomingShareId}`);
            this.setData({
                incomingShareViewerStatus: detail.viewer_status,
                incomingShareAgentName: detail.initiator_agent_name,
                incomingShareError: "",
            });
        }
        catch (error) {
            this.setData({
                incomingShareError: error instanceof Error ? error.message : "读取邀请失败",
            });
        }
        finally {
            this.setData({ incomingShareLoading: false });
        }
    },
    async acceptDirectShare() {
        if (!this.data.incomingShareId)
            return;
        this.setData({ directLoading: true, incomingShareError: "" });
        try {
            await request(this, `/api/direct-shares/${this.data.incomingShareId}/accept`, "POST");
            this.setData({ incomingAccepted: true });
            await loadDirectEdges(this);
            wx.showToast({ title: "已建立连接", icon: "success" });
        }
        catch (error) {
            this.setData({
                incomingShareError: error instanceof Error ? error.message : "建联失败",
            });
        }
        finally {
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
        ensureDirectShare(page);
        loadDirectEdges(page);
        if (page.data.incomingShareId)
            page.loadIncomingShare();
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
async function ensureDirectShare(page, showToast = false) {
    if (page.data.directShareId || page.data.directLoading)
        return;
    page.setData({ directLoading: true });
    try {
        const share = await request(page, "/api/direct-shares", "POST");
        page.setData({
            directShareId: share.share_id,
            directSharePath: share.share_path,
        });
        if (showToast)
            wx.showToast({ title: "可以分享给好友了", icon: "success" });
    }
    catch (error) {
        page.setData({
            error: error instanceof Error ? error.message : "准备分享失败",
        });
    }
    finally {
        page.setData({ directLoading: false });
    }
}
async function loadDirectEdges(page) {
    try {
        const data = await request(page, "/api/direct-edges");
        page.setData({ directEdges: data.edges || [] });
    }
    catch {
        page.setData({ directEdges: [] });
    }
}
function startPolling(page) {
    stopPolling();
    pollTimer = setInterval(async () => {
        try {
            const current = await request(page, "/api/agent-bindings/current");
            applyBindingState(page, current);
        }
        catch {
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
    }
    catch (error) {
        page.setData({
            error: error instanceof Error ? error.message : "请求失败",
        });
    }
    finally {
        page.setData({ loading: false });
    }
}
async function request(page, path, method = "GET", data, retryOnUnauthorized = true) {
    await ensureWechatLogin(page);
    const baseUrl = page.data.apiBaseUrl.replace(/\/$/, "");
    const res = await wxRequest(`${baseUrl}${path}`, method, data, {
        "Content-Type": "application/json",
        Authorization: `Bearer ${page.data.sessionToken}`,
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data;
    }
    if (res.statusCode === 401 && retryOnUnauthorized) {
        clearWechatSession(page);
        await ensureWechatLogin(page, true);
        return request(page, path, method, data, false);
    }
    const responseData = res.data;
    throw new Error(responseData?.error || `请求失败：${res.statusCode}`);
}
async function ensureWechatLogin(page, force = false) {
    const currentToken = page.data.sessionToken;
    const expiresAt = page.data.sessionExpiresAt;
    if (!force && currentToken && !isExpired(expiresAt))
        return currentToken;
    page.setData({ authLoading: true });
    try {
        const code = await wxLogin();
        const baseUrl = page.data.apiBaseUrl.replace(/\/$/, "");
        const login = await requestWechatLogin(baseUrl, code);
        wx.setStorageSync(SESSION_TOKEN_KEY, login.session_token);
        wx.setStorageSync(SESSION_EXPIRES_KEY, login.expires_at);
        page.setData({
            sessionToken: login.session_token,
            sessionExpiresAt: login.expires_at,
        });
        return login.session_token;
    }
    finally {
        page.setData({ authLoading: false });
    }
}
function wxLogin() {
    return new Promise((resolve, reject) => {
        wx.login({
            success: (res) => {
                if (res.code) {
                    resolve(res.code);
                    return;
                }
                reject(new Error(res.errMsg || "微信登录失败"));
            },
            fail: (err) => reject(new Error(err.errMsg || "微信登录失败")),
        });
    });
}
async function requestWechatLogin(baseUrl, code) {
    const res = await wxRequest(`${baseUrl}/api/wechat/login`, "POST", { code }, {
        "Content-Type": "application/json",
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
        return res.data;
    }
    const responseData = res.data;
    throw new Error(responseData?.error || `微信登录失败：${res.statusCode}`);
}
function wxRequest(url, method, data, header) {
    return new Promise((resolve, reject) => {
        wx.request({
            url,
            method,
            data,
            header,
            success: resolve,
            fail: (err) => reject(new Error(err.errMsg || "网络请求失败")),
        });
    });
}
function clearWechatSession(page) {
    wx.removeStorageSync(SESSION_TOKEN_KEY);
    wx.removeStorageSync(SESSION_EXPIRES_KEY);
    page.setData({ sessionToken: "", sessionExpiresAt: "" });
}
function isExpired(expiresAt) {
    if (!expiresAt)
        return false;
    return new Date(expiresAt).getTime() - Date.now() < 60 * 1000;
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

const store = require('../../utils/store');
const ai = require('../../utils/ai');

Page({
  data: {
    apiBaseUrl: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    sttUrl: '',
    systemPrompt: '',
    aiMode: 'direct',
    cloudEnv: '',
    tmplId: '',
    pushEnabled: false,
    showAdvanced: false,
    showSystemPrompt: false,
    testing: false,
    testResult: '',
    testStatus: '', // '' | 'success' | 'fail'
    showKey: false,
    presets: ai.PROVIDER_PRESETS || [],
    selectedPreset: '',
    modelOptions: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo',
      'deepseek-chat',
      'deepseek-reasoner',
      'qwen-plus',
      'qwen-max',
      'moonshot',
      'glm-4-flash',
    ],
  },

  onLoad() {
    const settings = store.getSettings();
    this.setData({
      apiBaseUrl: settings.apiBaseUrl || '',
      apiKey: settings.apiKey || '',
      model: settings.model || 'gpt-4o-mini',
      sttUrl: settings.sttUrl || '',
      systemPrompt: settings.systemPrompt || '',
      aiMode: settings.aiMode || 'direct',
      cloudEnv: settings.cloudEnv || '',
      tmplId: settings.tmplId || '',
      pushEnabled: !!settings.pushEnabled,
      selectedPreset: settings.provider || '',
    });
  },

  onBaseUrlInput(e) {
    this.setData({ apiBaseUrl: e.detail.value });
  },

  onKeyInput(e) {
    this.setData({ apiKey: e.detail.value });
  },

  onModelInput(e) {
    this.setData({ model: e.detail.value });
  },

  onModelSelect(e) {
    this.setData({ model: e.currentTarget.dataset.value });
  },

  onSttUrlInput(e) {
    this.setData({ sttUrl: e.detail.value });
  },

  // AI 调用方式切换：直连 / 云函数
  onAIModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ aiMode: mode });
    store.updateSettings({ aiMode: mode });
  },

  onCloudEnvInput(e) {
    this.setData({ cloudEnv: e.detail.value });
  },

  onTmplIdInput(e) {
    this.setData({ tmplId: e.detail.value });
  },

  // 服务通知推送开关
  onPushEnabledChange(e) {
    const val = e.currentTarget.dataset.val === 'true';
    this.setData({ pushEnabled: val });
    store.updateSettings({ pushEnabled: val });
    wx.showToast({ title: val ? '已开启推送' : '已关闭推送', icon: 'none' });
  },

  // 立即同步待提醒任务到云端 + 顺带请求订阅授权（用户手势触发，微信才允许弹窗）
  async onSyncNow() {
    if (!this.data.cloudEnv) {
      wx.showModal({
        title: '未配置云环境 ID',
        content: '服务通知推送需要云开发。请在高级配置中填写云环境 ID，并部署 syncReminders / pushReminders 两个云函数。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }
    // 先保存配置
    store.updateSettings({
      tmplId: this.data.tmplId.trim(),
      pushEnabled: this.data.pushEnabled,
      cloudEnv: this.data.cloudEnv.trim(),
    });
    wx.showLoading({ title: '同步中...' });
    try {
      const push = require('../../utils/push');
      const res = await push.sync();
      wx.hideLoading();
      if (res && res.ok) {
        wx.showToast({ title: `已同步 ${res.synced} 条提醒`, icon: 'success' });
        // 同步成功 → 立即请求订阅授权（必须用户手势触发）
        setTimeout(() => {
          push.requestSubscribe().then((r) => {
            if (r && r.ok) {
              wx.showToast({ title: '已授权推送', icon: 'success' });
            } else {
              wx.showModal({
                title: '授权失败',
                content: (r && r.errMsg) || '未知错误，请重试',
                showCancel: false,
                confirmText: '知道了',
              });
            }
          });
        }, 600);
      } else {
        wx.showToast({ title: (res && res.error) || '同步失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '同步失败', icon: 'none' });
    }
  },

  // 申请订阅消息权限（需在小程序后台配置模板并部署服务端定时下发）
  async onRequestSubscribe() {
    const reminder = require('../../utils/reminder');
    if (!this.data.tmplId) {
      wx.showModal({
        title: '未配置模板 ID',
        content: '订阅消息需要在「微信公众平台 - 订阅消息」中申请模板，并将模板 ID 填入高级配置，且需服务端定时下发才能真正推送。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }
    const ok = await reminder.requestSubscribe(this.data.tmplId);
    wx.showToast({ title: ok ? '已授权推送' : '', icon: ok ? 'success' : 'none' });
  },

  onSystemPromptInput(e) {
    this.setData({ systemPrompt: e.detail.value });
  },

  onToggleShowKey() {
    this.setData({ showKey: !this.data.showKey });
  },

  onToggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },

  onToggleSystemPrompt() {
    this.setData({ showSystemPrompt: !this.data.showSystemPrompt });
  },

  // 一键应用厂商预设
  onPresetTap(e) {
    const id = e.currentTarget.dataset.id;
    const preset = (this.data.presets || []).find((p) => p.id === id);
    if (!preset) return;
    this.setData({
      selectedPreset: id,
      apiBaseUrl: preset.baseUrl,
      model: preset.model,
    });
    wx.showToast({ title: `已选择 ${preset.name}`, icon: 'none' });
  },

  onResetPrompt() {
    this.setData({ systemPrompt: '' });
    wx.showToast({ title: '已重置为默认', icon: 'none' });
  },

  onSave() {
    if (!this.data.apiBaseUrl && !this.data.apiKey) {
      wx.showToast({ title: '请填写 API 配置', icon: 'none' });
      return;
    }

    if (!this.data.apiBaseUrl) {
      wx.showToast({ title: '请填写 API 地址', icon: 'none' });
      return;
    }

    if (!this.data.apiKey) {
      wx.showToast({ title: '请填写 API Key', icon: 'none' });
      return;
    }

    store.updateSettings({
      apiBaseUrl: this.data.apiBaseUrl.trim(),
      apiKey: this.data.apiKey.trim(),
      model: this.data.model.trim(),
      sttUrl: this.data.sttUrl.trim(),
      systemPrompt: this.data.systemPrompt.trim(),
      aiMode: this.data.aiMode,
      cloudEnv: this.data.cloudEnv.trim(),
      provider: this.data.selectedPreset,
      tmplId: this.data.tmplId.trim(),
      pushEnabled: this.data.pushEnabled,
    });

    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  },

  async onTest() {
    if (!this.data.apiBaseUrl || !this.data.apiKey) {
      wx.showToast({ title: '请先填写配置', icon: 'none' });
      return;
    }

    // 先保存临时配置
    store.updateSettings({
      apiBaseUrl: this.data.apiBaseUrl.trim(),
      apiKey: this.data.apiKey.trim(),
      model: this.data.model.trim(),
    });

    this.setData({ testing: true, testResult: '', testStatus: '' });

    try {
      const model = await ai.testConnection({
        apiBaseUrl: this.data.apiBaseUrl.trim(),
        apiKey: this.data.apiKey.trim(),
        model: this.data.model.trim(),
        aiMode: this.data.aiMode,
        cloudEnv: this.data.cloudEnv.trim(),
      });
      this.setData({
        testing: false,
        testResult: '连接成功！模型: ' + model,
        testStatus: 'success',
      });
    } catch (err) {
      this.setData({
        testing: false,
        testResult: err.message || '连接失败',
        testStatus: 'fail',
      });
    }
  },

  onClear() {
    wx.showModal({
      title: '清除配置',
      content: '确定要清除所有 API 配置吗？',
      confirmColor: '#E24B4A',
      success: (res) => {
        if (res.confirm) {
          store.updateSettings({
            apiBaseUrl: '',
            apiKey: '',
            model: 'gpt-4o-mini',
            sttUrl: '',
            systemPrompt: '',
            aiMode: 'direct',
            cloudEnv: '',
            provider: '',
            tmplId: '',
            pushEnabled: false,
          });
          this.setData({
            apiBaseUrl: '',
            apiKey: '',
            model: 'gpt-4o-mini',
            sttUrl: '',
            systemPrompt: '',
            aiMode: 'direct',
            cloudEnv: '',
            selectedPreset: '',
            tmplId: '',
            pushEnabled: false,
            testResult: '',
            testStatus: '',
          });
          wx.showToast({ title: '已清除', icon: 'none' });
        }
      },
    });
  },
});

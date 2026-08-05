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

  // 申请订阅消息权限（需在小程序后台配置模板并部署服务端定时下发）
  async onRequestSubscribe() {
    const ai = require('../../utils/ai');
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
            testResult: '',
            testStatus: '',
          });
          wx.showToast({ title: '已清除', icon: 'none' });
        }
      },
    });
  },
});

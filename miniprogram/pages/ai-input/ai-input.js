const ai = require('../../utils/ai');
const voice = require('../../utils/voice');
const store = require('../../utils/store');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');
const dateUtil = require('../../utils/date');

Page({
  data: {
    // 输入
    inputText: '',
    isRecording: false,
    isProcessing: false,
    processStep: '',

    // API 配置
    hasApiConfig: false,

    // 解析结果
    showResult: false,
    parsedTask: null,
    parsedTasks: [],
    isMulti: false,
    selectedTasks: {},
    recurrenceLabel: '',

    // 可编辑字段
    editTitle: '',
    editNote: '',
    editPriority: 0,
    editDueDate: '',
    editDueTime: '',
    editCategory: 'inbox',
    editRecurrence: null,
    editIsBirthday: false,
    editBirthdayName: '',
    editCalendarType: 'solar',

    // 选项
    categories: [],
    priorityOptions: [
      { value: 0, label: '无', color: '#CCCCCC' },
      { value: 1, label: '低', color: '#4A90D9' },
      { value: 2, label: '中', color: '#EF9F27' },
      { value: 3, label: '高', color: '#E24B4A' },
    ],

    // 示例
    examples: [
      '明天下午3点开会',
      '每周五提醒写周报',
      '每季度第二周前报税',
      '妈妈的生日 农历八月初十',
      '下周一上午9点去医院体检',
      '每天早上7点起床',
    ],

    // 显示控制
    showRecurrencePicker: false,
    showLunarLabel: '',
  },

  onLoad() {
    this.checkApiConfig();
    this.setData({ categories: store.getCategories() });
  },

  onShow() {
    this.checkApiConfig();
  },

  checkApiConfig() {
    const settings = store.getSettings();
    this.setData({
      hasApiConfig: !!(settings.apiBaseUrl && settings.apiKey),
    });
  },

  onTextInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  onClearInput() {
    this.setData({ inputText: '', showResult: false, parsedTask: null, parsedTasks: [], isMulti: false, selectedTasks: {} });
  },

  // 使用示例
  onExampleTap(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.onParse();
  },

  // 语音录音
  async onStartRecording() {
    if (!this.data.hasApiConfig) {
      wx.showModal({
        title: '未配置 API',
        content: '请先在设置中配置 API 地址和密钥，以及语音转文字端点',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/settings/settings' });
          }
        },
      });
      return;
    }

    const settings = store.getSettings();
    if (!settings.sttUrl) {
      wx.showModal({
        title: '未配置语音转文字',
        content: '语音输入需要配置语音转文字端点（STT URL），是否前往设置？',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/settings/settings' });
          }
        },
      });
      return;
    }

    const hasPermission = await voice.checkPermission();
    if (!hasPermission) {
      wx.showModal({
        title: '需要录音权限',
        content: '请在设置中允许录音权限以使用语音输入',
        showCancel: false,
      });
      return;
    }

    this.setData({ isRecording: true });

    voice.startRecording(
      async (res) => {
        this.setData({
          isRecording: false,
          isProcessing: true,
          processStep: '正在识别语音...',
        });

        try {
          const text = await voice.speechToText(res.tempFilePath, settings);
          this.setData({ inputText: text, processStep: '正在解析意图...' });
          this.onParse();
        } catch (err) {
          this.setData({ isRecording: false, isProcessing: false, processStep: '' });
          wx.showToast({ title: err.message || '语音识别失败', icon: 'none', duration: 3000 });
        }
      },
      (err) => {
        this.setData({ isRecording: false, isProcessing: false, processStep: '' });
        wx.showToast({ title: '录音失败', icon: 'none' });
      }
    );
  },

  onStopRecording() {
    voice.stopRecording();
  },

  // 解析文本
  async onParse() {
    const text = this.data.inputText.trim();
    if (!text) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    if (!this.data.hasApiConfig) {
      wx.showModal({
        title: '未配置 API',
        content: '请先在设置中配置 API 地址和密钥',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/settings/settings' });
          }
        },
      });
      return;
    }

    this.setData({ isProcessing: true, processStep: '正在解析意图...' });

    try {
      const settings = store.getSettings();
      const parsed = await ai.parseTask(text, settings);
      this.showParsedResult(parsed);
    } catch (err) {
      wx.showModal({
        title: '解析失败',
        content: err.message || 'AI 解析失败，请重试',
        showCancel: false,
      });
    } finally {
      this.setData({ isProcessing: false, processStep: '' });
    }
  },

  showParsedResult(taskList) {
    const list = Array.isArray(taskList) ? taskList : [taskList];
    if (!list.length) {
      wx.showToast({ title: '未解析到任务', icon: 'none' });
      return;
    }

    // 给每个任务附加展示用的标签
    const enriched = list.map((t, i) => ({
      ...t,
      _idx: i,
      recurrenceLabel: recurring.describeRecurrence(t.recurrence),
      calendarLabel: t.calendarType === 'lunar' ? '农历' : '公历',
      dateLabel: t.dueDate || '未设置',
      priorityLabel: ['无', '低', '中', '高'][t.priority] || '无',
    }));

    // 单任务：走原有编辑流程
    if (enriched.length === 1) {
      const parsed = enriched[0];
      this.setData({
        showResult: true,
        parsedTask: parsed,
        parsedTasks: [],
        isMulti: false,
        selectedTasks: {},
        recurrenceLabel: parsed.recurrenceLabel,
        showLunarLabel: parsed.calendarType === 'lunar' ? '农历' : '',
        editTitle: parsed.title || '',
        editNote: parsed.note || '',
        editPriority: parsed.priority || 0,
        editDueDate: parsed.dueDate || '',
        editDueTime: parsed.dueTime || '',
        editCategory: parsed.category || 'inbox',
        editRecurrence: parsed.recurrence || { type: 'none', interval: 1 },
        editIsBirthday: parsed.isBirthday || false,
        editBirthdayName: parsed.birthdayName || '',
        editCalendarType: parsed.calendarType || 'solar',
      });
      return;
    }

    // 多任务：列表勾选 + 批量创建
    const selected = {};
    enriched.forEach((_, i) => {
      selected[i] = true;
    });
    this.setData({
      showResult: true,
      parsedTask: null,
      parsedTasks: enriched,
      isMulti: true,
      selectedTasks: selected,
    });
  },

  // 多任务：勾选/取消单个
  onToggleTaskSelect(e) {
    const idx = e.currentTarget.dataset.idx;
    const sel = Object.assign({}, this.data.selectedTasks);
    sel[idx] = !sel[idx];
    this.setData({ selectedTasks: sel });
  },

  // 多任务：全选/取消全选
  onToggleSelectAll() {
    const sel = {};
    const anyOff = this.data.parsedTasks.some((_, i) => !this.data.selectedTasks[i]);
    this.data.parsedTasks.forEach((_, i) => {
      sel[i] = anyOff;
    });
    this.setData({ selectedTasks: sel });
  },

  // 编辑解析结果
  onEditTitle(e) {
    this.setData({ editTitle: e.detail.value });
  },

  onEditNote(e) {
    this.setData({ editNote: e.detail.value });
  },

  onEditPriority(e) {
    this.setData({ editPriority: parseInt(e.currentTarget.dataset.value) });
  },

  onEditDate(e) {
    this.setData({ editDueDate: e.detail.value });
  },

  onEditTime(e) {
    this.setData({ editDueTime: e.detail.value });
  },

  onEditCategory(e) {
    this.setData({ editCategory: e.currentTarget.dataset.id });
  },

  onEditBirthdayName(e) {
    this.setData({ editBirthdayName: e.detail.value });
  },

  onToggleCalendarType() {
    this.setData({
      editCalendarType: this.data.editCalendarType === 'solar' ? 'lunar' : 'solar',
    });
  },

  // 重复选择器
  onShowRecurrencePicker() {
    this.setData({ showRecurrencePicker: true });
  },

  onRecurrenceConfirm(e) {
    const recurrence = e.detail.recurrence;
    this.setData({
      editRecurrence: recurrence,
      showRecurrencePicker: false,
      recurrenceLabel: recurring.describeRecurrence(recurrence),
    });
  },

  onRecurrenceCancel() {
    this.setData({ showRecurrencePicker: false });
  },

  // 确认创建任务
  onConfirmCreate() {
    // 多任务：批量创建选中项
    if (this.data.isMulti) {
      const selected = this.data.parsedTasks.filter((_, i) => this.data.selectedTasks[i]);
      if (!selected.length) {
        wx.showToast({ title: '请至少选择一个任务', icon: 'none' });
        return;
      }
      selected.forEach((t) => {
        store.addTask({
          title: (t.title || '').trim() || '新任务',
          note: t.note || '',
          priority: t.priority || 0,
          dueDate: t.dueDate || '',
          dueTime: t.dueTime || '',
          category: t.category || 'inbox',
          recurrence: t.recurrence || { type: 'none', interval: 1 },
          isBirthday: !!t.isBirthday,
          birthdayName: t.birthdayName || '',
          calendarType: t.calendarType || 'solar',
          birthdayLunarMonth: t.birthdayLunarMonth || 0,
          birthdayLunarDay: t.birthdayLunarDay || 0,
          birthdayLunarIsLeap: !!t.birthdayLunarIsLeap,
          reminderOffset: t.reminderOffset !== undefined ? t.reminderOffset : null,
        });
      });
      wx.showToast({ title: '已创建 ' + selected.length + ' 个任务', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
      return;
    }

    // 单任务：走编辑后创建
    if (!this.data.editTitle.trim()) {
      wx.showToast({ title: '请输入任务标题', icon: 'none' });
      return;
    }

    const t = this.data.parsedTask || {};
    const taskData = {
      title: this.data.editTitle.trim(),
      note: this.data.editNote.trim(),
      priority: this.data.editPriority,
      dueDate: this.data.editDueDate,
      dueTime: this.data.editDueTime,
      category: this.data.editCategory,
      recurrence: this.data.editRecurrence,
      isBirthday: this.data.editIsBirthday,
      birthdayName: this.data.editBirthdayName,
      calendarType: this.data.editCalendarType,
      reminderOffset: t.reminderOffset !== undefined ? t.reminderOffset : null,
    };

    // 如果是农历生日，保存农历原始数据
    if (this.data.editIsBirthday && this.data.editCalendarType === 'lunar' && this.data.editDueDate) {
      // 优先用 AI 解析出的农历原始值，否则由公历 dueDate 反推
      if (t.birthdayLunarMonth && t.birthdayLunarDay) {
        taskData.birthdayLunarMonth = t.birthdayLunarMonth;
        taskData.birthdayLunarDay = t.birthdayLunarDay;
        taskData.birthdayLunarIsLeap = t.birthdayLunarIsLeap;
      } else {
        const lunarInfo = lunar.solarStrToLunar(this.data.editDueDate);
        if (lunarInfo) {
          taskData.birthdayLunarMonth = lunarInfo.month;
          taskData.birthdayLunarDay = lunarInfo.day;
          taskData.birthdayLunarIsLeap = lunarInfo.isLeap;
        }
      }
    }

    store.addTask(taskData);
    wx.showToast({ title: '任务已创建', icon: 'success' });

    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  },

  onDiscard() {
    this.setData({
      showResult: false,
      parsedTask: null,
      parsedTasks: [],
      isMulti: false,
      selectedTasks: {},
      inputText: '',
    });
  },

  onGoSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },
});

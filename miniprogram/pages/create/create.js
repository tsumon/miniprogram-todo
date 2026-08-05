const store = require('../../utils/store');
const dateUtil = require('../../utils/date');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');

Page({
  data: {
    title: '',
    note: '',
    priority: 0,
    dueDate: '',
    dueTime: '',
    category: 'inbox',
    categories: [],
    showDatePicker: false,
    showTimePicker: false,
    showCategoryPicker: false,
    dateLabel: '',
    quickDates: [],
    priorityOptions: [
      { value: 0, label: '无', color: '#CCCCCC' },
      { value: 1, label: '低', color: '#4A90D9' },
      { value: 2, label: '中', color: '#EF9F27' },
      { value: 3, label: '高', color: '#E24B4A' },
    ],
    pickerValue: [],
    timePickerValue: [9, 0],
    // v2: recurrence
    recurrence: { type: 'none', interval: 1 },
    recurrenceLabel: '',
    showRecurrencePicker: false,
    // v2: birthday
    isBirthday: false,
    birthdayName: '',
    calendarType: 'solar',
    // v3: reminder
    reminderOffset: null,
    reminderLabel: '不提醒',
    reminderOptions: [
      { value: null, label: '不提醒' },
      { value: 0, label: '准时' },
      { value: 15, label: '提前15分钟' },
      { value: 60, label: '提前1小时' },
      { value: 1440, label: '提前1天' },
    ],
  },

  onLoad() {
    const today = dateUtil.getToday();
    const tomorrow = dateUtil.getTomorrow();
    const day3 = dateUtil.getDateAfter(2);
    const day4 = dateUtil.getDateAfter(3);

    this.setData({
      categories: store.getCategories(),
      dueDate: today,
      dateLabel: '今天',
      quickDates: [
        { date: today, label: '今天' },
        { date: tomorrow, label: '明天' },
        { date: day3, label: dateUtil.formatDateLabel(day3) },
        { date: day4, label: dateUtil.formatDateLabel(day4) },
      ],
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onPrioritySelect(e) {
    this.setData({ priority: e.currentTarget.dataset.value });
  },

  onQuickDateSelect(e) {
    const { date, label } = e.currentTarget.dataset;
    this.setData({
      dueDate: date,
      dateLabel: label,
    });
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      dueDate: date,
      dateLabel: dateUtil.formatDateLabel(date),
    });
  },

  onTimeChange(e) {
    const time = e.detail.value;
    this.setData({ dueTime: time });
  },

  onTimeToggle() {
    if (this.data.dueTime) {
      this.setData({ dueTime: '' });
    }
  },

  onCategorySelect(e) {
    this.setData({ category: e.currentTarget.dataset.id });
  },

  // Recurrence
  onShowRecurrencePicker() {
    this.setData({ showRecurrencePicker: true });
  },

  onRecurrenceConfirm(e) {
    const recurrence = e.detail.recurrence;
    this.setData({
      recurrence: recurrence,
      showRecurrencePicker: false,
      recurrenceLabel: recurring.describeRecurrence(recurrence),
    });
  },

  onRecurrenceCancel() {
    this.setData({ showRecurrencePicker: false });
  },

  // Birthday
  onToggleBirthday() {
    const newVal = !this.data.isBirthday;
    const updates = { isBirthday: newVal };
    if (newVal) {
      updates.title = this.data.title || '';
    }
    this.setData(updates);
  },

  onBirthdayNameInput(e) {
    this.setData({ birthdayName: e.detail.value });
  },

  onToggleCalendarType() {
    this.setData({
      calendarType: this.data.calendarType === 'solar' ? 'lunar' : 'solar',
    });
  },

  // Reminder
  onReminderSelect(e) {
    const value = e.currentTarget.dataset.value;
    // dataset 中的 null 会变成空字符串，需还原
    const offset = value === '' || value === null ? null : parseInt(value);
    const opt = this.data.reminderOptions.find((o) => o.value === offset);
    this.setData({
      reminderOffset: offset,
      reminderLabel: opt ? opt.label : '不提醒',
    });
  },

  onSave() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入任务标题', icon: 'none' });
      return;
    }

    const taskData = {
      title: this.data.title.trim(),
      note: this.data.note.trim(),
      priority: this.data.priority,
      dueDate: this.data.dueDate,
      dueTime: this.data.dueTime,
      category: this.data.category,
      recurrence: this.data.recurrence,
      isBirthday: this.data.isBirthday,
      birthdayName: this.data.birthdayName,
      calendarType: this.data.calendarType,
      reminderOffset: this.data.reminderOffset,
    };

    // 农历生日：保存农历原始数据
    if (this.data.isBirthday && this.data.calendarType === 'lunar' && this.data.dueDate) {
      const lunarInfo = lunar.solarStrToLunar(this.data.dueDate);
      if (lunarInfo) {
        taskData.birthdayLunarMonth = lunarInfo.month;
        taskData.birthdayLunarDay = lunarInfo.day;
        taskData.birthdayLunarIsLeap = lunarInfo.isLeap;
      }
    }

    store.addTask(taskData);

    wx.showToast({ title: '已添加', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 800);
  },

  onCancel() {
    wx.navigateBack();
  },

  // AI 快捷入口
  onGoAIInput() {
    wx.navigateTo({ url: '/pages/ai-input/ai-input' });
  },
});

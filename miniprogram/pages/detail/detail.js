const store = require('../../utils/store');
const dateUtil = require('../../utils/date');
const recurring = require('../../utils/recurring');
const lunar = require('../../utils/lunar');

Page({
  data: {
    task: null,
    title: '',
    note: '',
    priority: 0,
    dueDate: '',
    dueTime: '',
    category: 'inbox',
    categories: [],
    dateLabel: '',
    completed: false,
    createdAt: '',
    recurrenceLabel: '',
    isBirthday: false,
    birthdayName: '',
    calendarType: 'solar',
    lunarLabel: '',
    priorityOptions: [
      { value: 0, label: '无', color: '#CCCCCC' },
      { value: 1, label: '低', color: '#4A90D9' },
      { value: 2, label: '中', color: '#EF9F27' },
      { value: 3, label: '高', color: '#E24B4A' },
    ],
  },

  onLoad(options) {
    const { id } = options;
    this.taskId = id;
    this.loadTask();
  },

  onShow() {
    if (this.taskId) {
      this.loadTask();
    }
  },

  loadTask() {
    const task = store.getTaskById(this.taskId);
    if (!task) {
      wx.showToast({ title: '任务不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }

    const cat = store.getCategoryById(task.category);
    const recurrenceLabel = task.recurrence && task.recurrence.type && task.recurrence.type !== 'none'
      ? recurring.describeRecurrence(task.recurrence)
      : '';
    const reminderLabel = task.reminderOffset === null || task.reminderOffset === undefined
      ? '不提醒'
      : (task.reminderOffset === 0 ? '准时' : `提前${task.reminderOffset}分钟`);
    let lunarLabel = '';
    if (task.isBirthday && task.calendarType === 'lunar' && task.birthdayLunarMonth) {
      lunarLabel = lunar.formatLunarDate(task.birthdayLunarMonth, task.birthdayLunarDay, task.birthdayLunarIsLeap);
    } else if (task.dueDate) {
      const lunarInfo = lunar.solarStrToLunar(task.dueDate);
      if (lunarInfo) {
        lunarLabel = lunarInfo.display;
      }
    }

    this.setData({
      task,
      title: task.title,
      note: task.note,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      category: task.category,
      dateLabel: task.dueDate ? dateUtil.formatDateLabel(task.dueDate) : '未设置',
      completed: task.completed,
      createdAt: task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '',
      categories: store.getCategories(),
      recurrenceLabel: recurrenceLabel,
      isBirthday: task.isBirthday || false,
      birthdayName: task.birthdayName || '',
      calendarType: task.calendarType || 'solar',
      lunarLabel: lunarLabel,
      reminderLabel: reminderLabel,
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

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      dueDate: date,
      dateLabel: date ? dateUtil.formatDateLabel(date) : '未设置',
    });
  },

  onTimeChange(e) {
    this.setData({ dueTime: e.detail.value });
  },

  onTimeToggle() {
    if (this.data.dueTime) {
      this.setData({ dueTime: '' });
    }
  },

  onCategorySelect(e) {
    this.setData({ category: e.currentTarget.dataset.id });
  },

  onToggleComplete() {
    const updated = store.toggleTask(this.taskId);
    if (updated) {
      this.setData({ completed: updated.completed });
      wx.vibrateShort({ type: 'light' });
    }
  },

  onSave() {
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入任务标题', icon: 'none' });
      return;
    }

    store.updateTask(this.taskId, {
      title: this.data.title.trim(),
      note: this.data.note.trim(),
      priority: this.data.priority,
      dueDate: this.data.dueDate,
      dueTime: this.data.dueTime,
      category: this.data.category,
    });

    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  },

  onDelete() {
    wx.showModal({
      title: '删除任务',
      content: '确定要删除这个任务吗？此操作不可撤销。',
      confirmColor: '#E24B4A',
      confirmText: '删除',
      success: (res) => {
        if (res.confirm) {
          store.deleteTask(this.taskId);
          wx.showToast({ title: '已删除', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 800);
        }
      },
    });
  },
});

const store = require('../../utils/store');
const dateUtil = require('../../utils/date');

Page({
  data: {
    stats: {},
    greeting: '',
    todayLabel: '',
    todayPercent: 0,
  },

  onLoad() {
    this.setData({
      greeting: dateUtil.getGreeting(),
      todayLabel: dateUtil.formatFullDate(),
    });
  },

  onShow() {
    const stats = store.getStats();
    this.setData({
      stats,
      greeting: dateUtil.getGreeting(),
      todayPercent: stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0,
    });
  },

  onShareAppMessage() {
    return {
      title: 'Todo 清单 - 高效管理你的每日任务',
      path: '/pages/index/index',
    };
  },

  onAbout() {
    wx.showModal({
      title: '关于 Todo 清单',
      content: '一个简洁高效的待办事项管理工具\n支持 AI 创建、周期任务、生日提醒\n\nv2.0.0',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onAIInput() {
    wx.navigateTo({ url: '/pages/ai-input/ai-input' });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  onFeedback() {
    wx.showToast({ title: '感谢反馈', icon: 'none' });
  },

  onClearCompleted() {
    wx.showModal({
      title: '清理已完成',
      content: '确定要删除所有已完成的任务吗？',
      confirmColor: '#E24B4A',
      success: (res) => {
        if (res.confirm) {
          const tasks = store.getTasks();
          const pending = tasks.filter((t) => !t.completed);
          wx.setStorageSync('todo_tasks', pending);
          const stats = store.getStats();
          this.setData({
            stats,
            todayPercent: stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0,
          });
          wx.showToast({ title: '已清理', icon: 'success' });
        }
      },
    });
  },
});

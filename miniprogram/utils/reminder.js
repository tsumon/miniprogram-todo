/**
 * utils/reminder.js
 * 本地提醒引擎
 *
 * 设计说明：
 * 微信小程序无法在后台主动推送，真正的"订阅消息推送"需要服务端（云函数定时触发）。
 * 本模块实现「应用内提醒」：任务到达提醒时间后，每次打开小程序 / 前台定时检查都会
 * 弹出提醒；只有用户「手动确认完成」任务，提醒才会彻底停止（否则可稍后提醒，到期再弹）。
 *
 * 若已配置订阅消息模板，可调用 requestSubscribe 申请权限（需配合服务端下发）。
 */

const store = require('./store');
const dateUtil = require('./date');

const SNOOZE_MINUTES = 30;

/**
 * 计算任务的提醒时间戳（ms）
 * reminderOffset 单位：分钟（null = 不提醒）
 */
const reminderTimestamp = (task) => {
  if (task.reminderOffset === null || task.reminderOffset === undefined) return null;
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split('-').map(Number);
  let hh = 9;
  let mm = 0;
  if (task.dueTime) {
    const parts = task.dueTime.split(':');
    hh = parseInt(parts[0]) || 0;
    mm = parseInt(parts[1]) || 0;
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime() - (task.reminderOffset || 0) * 60000;
};

/**
 * 判断任务是否处于「待提醒」状态
 */
const isPending = (task, now) => {
  if (task.completed) return false;
  if (task.reminderOffset === null || task.reminderOffset === undefined) return false;
  const ts = reminderTimestamp(task);
  if (ts === null || ts > now) return false;
  if (task.snoozeUntil && task.snoozeUntil > now) return false;
  return true;
};

/**
 * 获取当前所有待提醒任务
 */
const getPendingReminders = () => {
  const now = Date.now();
  return store.getTasks().filter((t) => isPending(t, now));
};

/**
 * 队列展示提醒弹窗。
 * - 点击「标记完成」→ 完成任务（提醒停止）
 * - 点击「稍后提醒」→ 推迟 SNOOZE_MINUTES 分钟后再弹
 * @param {Function} onDone 全部处理完回调
 */
const showReminders = (onDone) => {
  const pending = getPendingReminders();
  if (pending.length === 0) {
    if (onDone) onDone();
    return;
  }

  let i = 0;
  const next = () => {
    if (i >= pending.length) {
      if (onDone) onDone();
      return;
    }
    const task = pending[i++];
    const timeLabel = task.dueTime ? ` ${task.dueTime}` : '';
    wx.showModal({
      title: '⏰ 任务提醒',
      content: `${task.title}${timeLabel}\n到时间啦，记得完成哦～`,
      confirmText: '标记完成',
      confirmColor: '#4A90D9',
      cancelText: '稍后提醒',
      success: (res) => {
        if (res.confirm) {
          store.toggleTask(task.id); // 标记完成 → 提醒停止
          wx.showToast({ title: '已完成', icon: 'success' });
        } else {
          // 稍后提醒：推迟一段时间
          store.updateTask(task.id, { snoozeUntil: Date.now() + SNOOZE_MINUTES * 60000 });
        }
        next();
      },
    });
  };
  next();
};

/**
 * 申请订阅消息权限（需在小程序后台配置模板，并配合服务端下发）
 * @param {string} templateId 订阅消息模板 ID
 */
const requestSubscribe = (templateId) => {
  if (!templateId) return Promise.resolve(false);
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
};

module.exports = {
  reminderTimestamp,
  getPendingReminders,
  showReminders,
  requestSubscribe,
  SNOOZE_MINUTES,
};

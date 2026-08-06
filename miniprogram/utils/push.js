/**
 * utils/push.js
 * 微信服务通知（订阅消息）推送的前端桥接层。
 *
 * 职责：
 *   1. 计算任务提醒时间戳（与 utils/reminder.js 保持同一算法）
 *   2. 把「待提醒且未完成」的任务同步到云数据库（经 syncReminders 云函数）
 *   3. 请求订阅消息授权（一次性订阅：每次授权 = 1 次推送机会）
 *
 * 依赖：
 *   - 已开通云开发，且 settings.pushEnabled === true
 *   - 已部署 cloudfunctions/syncReminders（同步）与 pushReminders（定时推送）
 *   - 已申请订阅消息模板并填入 settings.tmplId
 */

const store = require('./store');

// 记录已初始化的环境 ID（避免重复 init；不同 env 自动重新 init）
let _cloudInitEnv = null;

/**
 * 懒初始化云开发：每次调用云函数前确保 wx.cloud.init 已执行。
 * 解决「用户首次启动 cloudEnv 为空 → init 跳过 → 后续填了也调不通」的问题。
 */
const ensureCloudInit = (env) => {
  if (!env) return false;
  if (typeof wx.cloud === 'undefined' || !wx.cloud) return false;
  if (_cloudInitEnv === env) return true;
  try {
    wx.cloud.init({ env, traceUser: true });
    _cloudInitEnv = env;
    return true;
  } catch (e) {
    console.error('wx.cloud.init failed:', e);
    return false;
  }
};

/** 计算任务提醒时间戳（ms），无提醒返回 null */
const getRemindAt = (task) => {
  if (!task || task.reminderOffset === null || task.reminderOffset === undefined || !task.dueDate) {
    return null;
  }
  const [y, m, d] = task.dueDate.split('-').map(Number);
  let hh = 9;
  let mm = 0;
  if (task.dueTime) {
    const p = task.dueTime.split(':');
    hh = parseInt(p[0]) || 0;
    mm = parseInt(p[1]) || 0;
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime() - (task.reminderOffset || 0) * 60000;
};

/** 推送是否已就绪（开关 + 模板 ID + 云能力 + 环境 ID） */
const isReady = () => {
  const s = store.getSettings();
  return !!(
    s.pushEnabled &&
    s.tmplId &&
    s.cloudEnv &&
    typeof wx.cloud !== 'undefined' &&
    wx.cloud
  );
};

/**
 * 同步本地待提醒任务到云端。
 * 每次调用把「未完成且设了提醒」的任务全量上报（云端按 taskId upsert），
 * 并标记本地已完成的任务为 done（不再推送）。
 */
const sync = () => {
  if (!isReady()) {
    return Promise.resolve({ skipped: true });
  }
  const settings = store.getSettings();
  if (!ensureCloudInit(settings.cloudEnv)) {
    return Promise.resolve({ error: 'wx.cloud.init failed' });
  }

  const tasks = store.getTasks();
  const pending = tasks.filter((t) => !t.completed && getRemindAt(t) !== null);
  const doneIds = tasks.filter((t) => t.completed).map((t) => t.id);

  return wx.cloud
    .callFunction({
      name: 'syncReminders',
      data: {
        tasks: pending,
        doneTaskIds: doneIds,
        templateId: settings.tmplId,
      },
    })
    .then((res) => (res && res.result) || {})
    .catch((err) => ({ error: (err && err.errMsg) || 'sync failed' }));
};

/**
 * 请求订阅消息授权。
 * 一次性订阅：用户点「允许」= 获得 1 次推送机会，用完需再次授权。
 * @returns {Promise<{ok: boolean, errMsg?: string}>}
 */
const requestSubscribe = () => {
  if (!isReady()) return Promise.resolve({ ok: false, errMsg: '推送未就绪（开关/模板ID/云环境ID未配置）' });
  const tmplId = store.getSettings().tmplId;
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: (res) => {
        const status = res[tmplId];
        if (status === 'accept') {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, errMsg: '用户未点「允许」(' + status + ')' });
        }
      },
      fail: (err) => {
        // errMsg 常见：requestSubscribeMessage:fail template no exist / invalid template id 等
        resolve({ ok: false, errMsg: (err && err.errMsg) || '授权调用失败' });
      },
    });
  });
};

module.exports = {
  getRemindAt,
  sync,
  requestSubscribe,
  isReady,
  ensureCloudInit,
};

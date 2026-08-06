/**
 * cloudfunctions/syncReminders/index.js
 * 前端把「待提醒且未完成」的任务同步到云数据库 reminders 集合。
 * - 自动获取调用者 OPENID（定时触发器拿不到，所以必须在这里落库）
 * - 已完成的本地任务 → 标记 done，不再推送
 * - 每个任务 upsert（同 openid + taskId 查重）
 *
 * 调用方：miniprogram/utils/push.js
 * 依赖：云数据库集合 reminders（在云开发控制台手动创建）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const pad = (n) => String(n).padStart(2, '0');

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { error: 'no openid' };

  const tasks = (event.tasks || []).filter(
    (t) => t && t.id && t.dueDate && t.reminderOffset !== null && t.reminderOffset !== undefined
  );
  const doneTaskIds = event.doneTaskIds || [];
  const templateId = event.templateId || '';

  let synced = 0;
  let removed = 0;

  // 1. 本地已完成的旧提醒 → done（不再推送）
  if (doneTaskIds.length > 0) {
    try {
      const res = await db
        .collection('reminders')
        .where({ openid: OPENID, taskId: _.in(doneTaskIds), done: false })
        .update({ data: { done: true, updatedAt: db.serverDate() } });
      removed = res.stats.updated || 0;
    } catch (e) {
      console.error('mark done fail:', e);
    }
  }

  // 2. upsert 待提醒任务
  for (const t of tasks) {
    try {
      const [y, m, d] = t.dueDate.split('-').map(Number);
      if (!y || !m || !d) continue;

      let hh = 9;
      let mm = 0;
      if (t.dueTime) {
        const p = t.dueTime.split(':');
        hh = parseInt(p[0]) || 0;
        mm = parseInt(p[1]) || 0;
      }

      const remindAt = new Date(y, m - 1, d, hh, mm, 0, 0).getTime() - (t.reminderOffset || 0) * 60000;
      const timeStr = `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mm)}`;
      const title = (t.title || '待办提醒').slice(0, 20);

      const record = {
        openid: OPENID,
        taskId: t.id,
        title,
        remindAt,
        templateId,
        // 默认「日程提醒」模板字段：thing1 事项 + time2 时间
        // 若你申请的模板字段不同，请到公众平台按模板字段修改这里
        templateData: {
          thing1: { value: title },
          time2: { value: timeStr },
        },
        pushed: false,
        done: false,
        updatedAt: db.serverDate(),
      };

      const existing = await db
        .collection('reminders')
        .where({ openid: OPENID, taskId: t.id })
        .limit(1)
        .get();

      if (existing.data.length > 0) {
        const doc = existing.data[0];
        // 已推送过的保留原记录（避免改回去重复推）
        if (!doc.pushed) {
          await db.collection('reminders').doc(doc._id).update({ data: record });
        }
      } else {
        await db.collection('reminders').add({ data: record });
      }
      synced++;
    } catch (e) {
      console.error('sync task fail:', t.id, e);
    }
  }

  return { ok: true, synced, removed, openid: OPENID };
};

/**
 * cloudfunctions/pushReminders/index.js
 * 定时推送微信服务通知（订阅消息）。
 *
 * 流程：
 *   定时触发器（默认每 30 分钟）→ 扫描 reminders 集合中
 *   remindAt <= now && !pushed && !done 的记录 →
 *   cloud.openapi.subscribeMessage.send 下发服务通知 → 标记 pushed。
 *
 * 前提（一次性配置，见部署文档）：
 *   1. 云开发控制台开通「订阅消息」开放接口调用权限
 *   2. 云数据库已创建 reminders 集合
 *   3. 小程序已申请「日程提醒」类订阅消息模板，模板 ID 与
 *      syncReminders 写入的 templateId / templateData 字段一致
 *
 * 注意：一次性订阅消息每次用户授权只能推送 1 次，
 *      所以「每次打开小程序自动申请授权」是攒次数的关键。
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 推送环境：正式版填 'formal'；用「体验版」测试时填 'trial'
const MINI_PROGRAM_STATE = 'trial';

exports.main = async () => {
  const now = Date.now();
  const { data } = await db
    .collection('reminders')
    .where({
      remindAt: _.lte(now),
      pushed: false,
      done: false,
    })
    .limit(100)
    .get();

  let pushed = 0;
  let failed = 0;
  const errors = [];

  for (const r of data) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: r.openid,
        templateId: r.templateId,
        page: 'pages/index/index',
        miniprogramState: MINI_PROGRAM_STATE,
        lang: 'zh_CN',
        data: r.templateData || {},
      });
      await db.collection('reminders').doc(r._id).update({
        data: { pushed: true, pushedAt: db.serverDate() },
      });
      pushed++;
    } catch (e) {
      failed++;
      errors.push({ id: r._id, errCode: e.errCode, errMsg: e.errMsg });
      console.error('push fail:', r._id, e.errCode, e.errMsg);

      // 43101 = 用户订阅次数用完/未授权（一次性订阅常态），标记 done 防止反复重试
      // 40003 = openid 无效；43101 也常伴随 openid 为体验版用户
      if (e.errCode === 43101 || e.errCode === 40003) {
        try {
          await db.collection('reminders').doc(r._id).update({
            data: { done: true, failCode: e.errCode, updatedAt: db.serverDate() },
          });
        } catch (e2) {
          console.error('mark fail:', r._id, e2);
        }
      }
    }
  }

  return {
    total: data.length,
    pushed,
    failed,
    errors: errors.slice(0, 5),
    time: new Date().toISOString(),
  };
};

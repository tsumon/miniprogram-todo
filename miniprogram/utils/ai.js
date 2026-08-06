/**
 * utils/ai.js
 * AI 意图识别模块
 *
 * 支持两种调用模式（在「设置 - 基础配置」中一键切换）：
 *  - 'direct' 直连第三方 OpenAI 兼容 API
 *      · 需在小程序公众平台「服务器域名 - request 合法域名」中配置对方域名
 *      · 适合开发预览（勾选「不校验合法域名」）或已配置域名的场景
 *  - 'cloud'  通过微信云开发云函数转发（推荐自用）
 *      · 小程序只调 wx.cloud.callFunction（微信自家域名，自动免白名单）
 *      · 云函数服务端再请求第三方，免服务器、免域名配置、0 成本
 *
 * parseTask / testConnection 均按 settings.aiMode 自动路由，调用方无感。
 */

const lunar = require('./lunar');

/** 云函数名称（需在云开发控制台部署同名云函数） */
const CLOUD_FN_NAME = 'aiProxy';

/**
 * 主流厂商快捷配置（OpenAI 兼容格式）
 * 切换后自动填充 API Base URL 与默认模型
 */
const PROVIDER_PRESETS = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT 系列', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'deepseek', name: 'DeepSeek', desc: '深度求索', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'qwen', name: '通义千问', desc: '阿里云', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'bailian', name: '阿里百炼', desc: '百炼平台', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
  { id: 'moonshot', name: 'Kimi', desc: '月之暗面', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'zhipu', name: '智谱 GLM', desc: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'doubao', name: '豆包', desc: '字节跳动', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k' },
  { id: 'custom', name: '自定义', desc: '自定义端点', baseUrl: '', model: '' },
];

const DEFAULT_SYSTEM_PROMPT = `你是一个智能任务解析助手。用户会用自然语言描述一个或多个待办事项或提醒，请将其解析为结构化的JSON格式。当用户一次描述多个事项（例如多人生日）时，必须把每一项都解析出来，放入 tasks 数组。

当前日期信息：
- 今天日期: {{TODAY}}
- 星期: {{WEEKDAY}}

请返回以下JSON格式（仅返回JSON，不要包含任何其他文字或解释）：
{
  "tasks": [
    {
      "title": "任务标题（简洁明了，不超过20字）",
      "note": "备注说明，没有则为空字符串",
      "priority": 0,
      "dueDate": "YYYY-MM-DD",
      "dueTime": "HH:MM 或空字符串",
      "category": "inbox",
      "recurrence": {
        "type": "none",
        "interval": 1,
        "mode": "date",
        "dayOfWeek": null,
        "dayOfMonth": null,
        "monthOfYear": null,
        "weekOfQuarter": null
      },
      "isBirthday": false,
      "birthdayName": "",
      "calendarType": "solar",
      "birthdayLunarMonth": 0,
      "birthdayLunarDay": 0,
      "birthdayLunarIsLeap": false,
      "reminderOffset": null
    }
  ]
}

字段说明：
1. title: 从用户描述中提取的任务标题
2. note: 用户提到的额外说明
3. priority: 0=无, 1=低, 2=中, 3=高。紧急/重要=3，一般=2，不急=1，未提及=0
4. dueDate: 根据当前日期计算具体日期。"明天"=当前+1，"后天"=当前+2，"下周一"=计算具体日期，"3号"=当月或下月3号，"月底"=当月最后一天
5. dueTime: 用户提到具体时间时填HH:MM格式。"下午3点"="15:00"，"上午9点半"="09:30"，"晚上8点"="20:00"。未提及则为空字符串
6. recurrence:
   - "每天"=type:"daily",interval:1
   - "工作日"=type:"weekly",interval:1（如指定星期则加 dayOfWeek:0-6，0=周日）
   - "每周X"=type:"weekly",interval:1,dayOfWeek:0-6(0=周日)
   - "每N周"=type:"weekly",interval:N
   - "每月X号"=type:"monthly",interval:1,dayOfMonth:X
   - "每季度"：默认 type:"quarterly",mode:"date",dayOfMonth:X（季度首月X号）
   - "每季度第N周周X"（如"每季度第二周周三"）=type:"quarterly",mode:"week",weekOfQuarter:N,dayOfWeek:X
   - "每半年"=type:"monthly",interval:6
   - "每年X月X日"=type:"yearly",interval:1,monthOfYear:X,dayOfMonth:X
   - "每两年"=type:"yearly",interval:2
   - 生日：recurrence 固定填 type:"none"（生日跨年由系统自动处理，无需重复规则）
   - 无周期表述则type:"none"
7. isBirthday: 用户提到"生日"或"XX的生日"时设为true，birthdayName为生日主人名字
8. calendarType: 用户提到"农历"或"阴历"时设为"lunar"，否则为"solar"
9. birthdayLunarMonth / birthdayLunarDay / birthdayLunarIsLeap: 仅当 calendarType 为 "lunar" 的生日时填写。农历月(1-12)、农历日(1-30)、是否闰月。例如"农历八月初十"→birthdayLunarMonth:8, birthdayLunarDay:10, birthdayLunarIsLeap:false；"农历闰六月初一"→6,1,true。公历生日或不涉及农历时填 0,0,false。
10. reminderOffset: 提醒提前量（分钟）。"提前1小时"=60，"提前15分钟"=15，"提前1天"=1440，"准时"=0，未提及则为 null
11. 如果有周期但没有明确日期，dueDate设为从今天开始计算的首次到期日
12. 如果是公历生日提醒，dueDate设为今年的生日日期（如果今年已过则设为明年）
13. 如果是农历生日提醒，dueDate 填写今年对应的公历日期（如果今年已过则填明年）；同时必须填写 birthdayLunarMonth/birthdayLunarDay/birthdayLunarIsLeap 原始农历值
14. 多任务：用户一次描述多个事项时，tasks 数组放多个完整对象。例如"张三生日5月1日，李四生日农历八月初八"→两个任务对象，张三 isBirthday:true calendarType:"solar" dueDate:"今年5月1日"，李四 isBirthday:true calendarType:"lunar" birthdayLunarMonth:8 birthdayLunarDay:8 dueDate:"今年农历八月初八对应的公历日期"`;

/**
 * 将 Date 格式化为 YYYY-MM-DD
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/* ----------------------- 模式管理 ----------------------- */

// 懒加载 store，避免模块加载顺序问题（store 不依赖 ai，无循环依赖）
let _store = null;
const getStore = () => {
  if (!_store) _store = require('./store');
  return _store;
};

/**
 * 读取当前 AI 调用模式：'direct' | 'cloud'
 */
const getAIMode = () => {
  try {
    return getStore().getSettings().aiMode === 'cloud' ? 'cloud' : 'direct';
  } catch (e) {
    return 'direct';
  }
};

/**
 * 设置 AI 调用模式，持久化到 settings
 */
const setAIMode = (mode) => {
  getStore().updateSettings({ aiMode: mode === 'cloud' ? 'cloud' : 'direct' });
};

/* ----------------------- 网络层（双模式） ----------------------- */

/**
 * 直连第三方 OpenAI 兼容 API
 */
const callDirect = (payload) => {
  return new Promise((resolve, reject) => {
    if (!payload.baseUrl || !payload.apiKey) {
      reject(new Error('请先在设置中配置 API 地址和密钥'));
      return;
    }

    wx.request({
      url: payload.baseUrl + '/chat/completions',
      method: 'POST',
      timeout: 30000,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + payload.apiKey,
      },
      data: {
        model: payload.model,
        messages: payload.messages,
        temperature: payload.temperature,
        response_format: { type: 'json_object' },
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(
            new Error(
              'API 返回 ' +
                res.statusCode +
                ': ' +
                (res.data && res.data.error && res.data.error.message
                  ? res.data.error.message
                  : JSON.stringify(res.data))
            )
          );
          return;
        }

        const content =
          res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message
            ? res.data.choices[0].message.content
            : '';
        if (!content) {
          reject(new Error('API 返回格式异常'));
          return;
        }
        resolve(content);
      },
      fail: (err) => {
        reject(new Error('网络请求失败: ' + (err.errMsg || JSON.stringify(err))));
      },
    });
  });
};

/**
 * 云开发云函数转发（免服务器域名配置）
 */
const callCloud = (payload) => {
  return new Promise((resolve, reject) => {
    if (typeof wx.cloud === 'undefined' || !wx.cloud) {
      reject(new Error('未初始化云开发：请在开发者工具中开通云开发，并在设置中填写云环境 ID'));
      return;
    }
    if (!payload.baseUrl || !payload.apiKey) {
      reject(new Error('请先在设置中配置 API 地址和密钥'));
      return;
    }

    wx.cloud.callFunction({
      name: CLOUD_FN_NAME,
      data: {
        baseUrl: payload.baseUrl,
        model: payload.model,
        apiKey: payload.apiKey,
        messages: payload.messages,
        temperature: payload.temperature,
        test: !!payload.test,
      },
      success: (res) => {
        const result = (res && res.result) || {};
        if (result.ok) {
          resolve(result.content);
        } else {
          reject(new Error(result.error || '云函数返回异常'));
        }
      },
      fail: (err) => {
        reject(new Error('云函数调用失败: ' + (err.errMsg || JSON.stringify(err))));
      },
    });
  });
};

/**
 * 统一的对话补全调用入口，按 mode 分流
 * @returns {Promise<string>} 模型返回的原始 content 文本
 */
const callChatCompletions = (payload) => {
  const mode = payload.mode || getAIMode();
  return mode === 'cloud' ? callCloud(payload) : callDirect(payload);
};

/* ----------------------- 对外业务接口 ----------------------- */

/**
 * 调用 AI API 解析自然语言为结构化任务
 * @param {string} text 用户输入的文本
 * @param {Object} settings API配置（apiBaseUrl, apiKey, model, systemPrompt, aiMode）
 * @returns {Promise<Array<Object>>} 解析后的任务对象数组（始终返回数组，单个任务也是长度1的数组）
 */
const parseTask = (text, settings) => {
  const s = settings || {};
  const now = new Date();
  const todayStr = formatDate(now);
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const systemPrompt = (s.systemPrompt || DEFAULT_SYSTEM_PROMPT)
    .replace(/\{\{TODAY\}\}/g, todayStr)
    .replace(/\{\{WEEKDAY\}\}/g, weekdayNames[now.getDay()]);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text },
  ];

  const payload = {
    mode: s.aiMode || getAIMode(),
    baseUrl: (s.apiBaseUrl || '').replace(/\/+$/, ''),
    model: s.model || 'gpt-4o-mini',
    apiKey: s.apiKey || '',
    messages,
    temperature: 0.3,
  };

  return callChatCompletions(payload).then((content) => {
    let jsonStr = (content || '').trim();
    // 去除可能的 markdown 代码块
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('解析 AI 返回失败: ' + e.message + ' 原始内容: ' + content.substring(0, 200));
    }
    // 兼容三种返回形态：{tasks:[...]} / 单对象 / 数组
    let taskList;
    if (Array.isArray(parsed)) {
      taskList = parsed;
    } else if (parsed && Array.isArray(parsed.tasks)) {
      taskList = parsed.tasks;
    } else if (parsed && typeof parsed === 'object') {
      taskList = [parsed];
    } else {
      taskList = [];
    }
    return taskList.map(normalizeParsedTask);
  });
};

/**
 * 规范化解析后的任务对象，补充默认值
 */
const normalizeParsedTask = (parsed) => {
  if (!parsed || typeof parsed !== 'object') parsed = {};

  // 确保 recurrence 存在
  if (!parsed.recurrence) {
    parsed.recurrence = { type: 'none', interval: 1 };
  }
  if (!parsed.recurrence.type) {
    parsed.recurrence.type = 'none';
  }
  if (!parsed.recurrence.interval) {
    parsed.recurrence.interval = 1;
  }
  if (!parsed.recurrence.mode && parsed.recurrence.type === 'quarterly') {
    parsed.recurrence.mode = parsed.recurrence.weekOfQuarter ? 'week' : 'date';
  }

  // 确保 priority 是数字
  parsed.priority = parseInt(parsed.priority) || 0;
  if (parsed.priority < 0) parsed.priority = 0;
  if (parsed.priority > 3) parsed.priority = 3;

  // 确保布尔值
  parsed.isBirthday = !!parsed.isBirthday;
  parsed.calendarType = parsed.calendarType === 'lunar' ? 'lunar' : 'solar';

  // 提醒提前量（生日任务默认到期时提醒，普通任务默认不提醒）
  if (parsed.reminderOffset === undefined || parsed.reminderOffset === null) {
    parsed.reminderOffset = parsed.isBirthday ? 0 : null;
  } else {
    const v = parseInt(parsed.reminderOffset);
    parsed.reminderOffset = isNaN(v) ? (parsed.isBirthday ? 0 : null) : v;
  }

  // 生日：公历生日自动设置 yearly 周期，每年自动提醒
  // 农历生日保持 none（跨年由 checkBirthdayTasks 根据农历月日单独计算）
  if (parsed.isBirthday) {
    if (parsed.calendarType === 'solar' && parsed.dueDate) {
      const parts = parsed.dueDate.split('-').map(Number);
      if (parts.length === 3 && parts[1] && parts[2]) {
        parsed.recurrence = {
          type: 'yearly',
          interval: 1,
          monthOfYear: parts[1],
          dayOfMonth: parts[2],
        };
      }
    } else {
      // 农历生日或无法确定公历日期时保持 none
      parsed.recurrence = { type: 'none', interval: 1 };
    }
  }

  // 农历生日处理：优先用 AI 给的农历月日计算公历 dueDate；若 AI 只给了公历 dueDate 则反推农历
  if (parsed.isBirthday && parsed.calendarType === 'lunar') {
    const lm = parseInt(parsed.birthdayLunarMonth);
    const ld = parseInt(parsed.birthdayLunarDay);
    if (lm > 0 && ld > 0) {
      parsed.birthdayLunarMonth = lm;
      parsed.birthdayLunarDay = ld;
      parsed.birthdayLunarIsLeap = !!parsed.birthdayLunarIsLeap;
      // 用农历月日计算今年（或明年）的公历 dueDate
      const solar = lunar.getNextLunarBirthday(lm, ld, parsed.birthdayLunarIsLeap, new Date());
      if (solar) parsed.dueDate = solar;
    } else if (parsed.dueDate) {
      // AI 已算出公历 dueDate，反推农历原始值保存
      const info = lunar.solarStrToLunar(parsed.dueDate);
      if (info) {
        parsed.birthdayLunarMonth = info.month;
        parsed.birthdayLunarDay = info.day;
        parsed.birthdayLunarIsLeap = info.isLeap;
      }
    }
  } else {
    parsed.birthdayLunarMonth = parseInt(parsed.birthdayLunarMonth) || 0;
    parsed.birthdayLunarDay = parseInt(parsed.birthdayLunarDay) || 0;
    parsed.birthdayLunarIsLeap = !!parsed.birthdayLunarIsLeap;
  }

  // 确保 category 有默认值
  if (!parsed.category) parsed.category = 'inbox';

  // 确保 note 有默认值
  if (!parsed.note) parsed.note = '';

  // 确保 birthdayName 有默认值
  if (!parsed.birthdayName) parsed.birthdayName = '';

  return parsed;
};

/**
 * 测试 API 连通性（按 mode 路由到直连或云函数）
 * @param {Object} settings API配置
 * @returns {Promise<string>} 成功返回模型名称，失败 reject Error
 */
const testConnection = (settings) => {
  const s = settings || {};
  const baseUrl = (s.apiBaseUrl || '').replace(/\/+$/, '');
  const model = s.model || 'gpt-4o-mini';
  const apiKey = s.apiKey || '';
  const mode = s.aiMode || getAIMode();
  const cloudEnv = s.cloudEnv || '';

  return new Promise((resolve, reject) => {
    if (mode === 'cloud') {
      if (typeof wx.cloud === 'undefined') {
        reject(new Error('当前环境不支持云开发'));
        return;
      }
      if (!cloudEnv) {
        reject(new Error('请先在设置中填写云环境 ID'));
        return;
      }
      if (!baseUrl || !apiKey) {
        reject(new Error('请先填写 API 地址和密钥'));
        return;
      }

      // 确保云开发已用正确的环境 ID 初始化（用户可能刚改了 cloudEnv 还没保存重启）
      try {
        wx.cloud.init({ env: cloudEnv, traceUser: false });
      } catch (e) {
        // init 重复调用会抛异常，可忽略
      }

      wx.cloud.callFunction({
        name: CLOUD_FN_NAME,
        data: {
          baseUrl,
          model,
          apiKey,
          messages: [{ role: 'user', content: '请回复"ok"' }],
          temperature: 0,
          test: true,
        },
        success: (res) => {
          const result = (res && res.result) || {};
          if (result.ok) {
            resolve(result.model || model);
          } else {
            reject(new Error(result.error || '云函数连接失败'));
          }
        },
        fail: (err) => {
          reject(new Error('云函数调用失败: ' + (err.errMsg || '无法连接')));
        },
      });
      return;
    }

    // 直连模式
    if (!baseUrl || !apiKey) {
      reject(new Error('请先填写 API 地址和密钥'));
      return;
    }

    wx.request({
      url: baseUrl + '/chat/completions',
      method: 'POST',
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      data: {
        model,
        messages: [{ role: 'user', content: '请回复"ok"' }],
        max_tokens: 10,
        temperature: 0,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const m = res.data && res.data.model ? res.data.model : model;
          resolve(m);
        } else {
          reject(
            new Error(
              'HTTP ' +
                res.statusCode +
                ': ' +
                (res.data && res.data.error && res.data.error.message
                  ? res.data.error.message
                  : '连接失败')
            )
          );
        }
      },
      fail: (err) => {
        reject(new Error('网络错误: ' + (err.errMsg || '无法连接')));
      },
    });
  });
};

module.exports = {
  parseTask,
  testConnection,
  getAIMode,
  setAIMode,
  CLOUD_FN_NAME,
  DEFAULT_SYSTEM_PROMPT,
  PROVIDER_PRESETS,
  formatDate,
};

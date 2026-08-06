/**
 * 云函数 aiProxy
 * 微信云开发「云函数」样例 —— 由小程序在「AI 调用方式 = 云函数」模式下调用
 *
 * 作用：在服务端（云函数）转发 OpenAI 兼容的 /chat/completions 请求，
 * 让小程序无需配置 request 合法域名即可调用第三方大模型。
 *
 * 部署步骤：
 *  1. 微信开发者工具 → 开通「云开发」→ 新建环境（记下环境 ID）
 *  2. 在 cloudfunctions/aiProxy 目录右键「上传并部署（云端安装依赖）」
 *  3. 小程序「设置 - 基础配置」选「云函数」并填写云环境 ID
 *
 * 说明：
 *  - apiKey 由小程序通过 data 传入（自用足够安全）；如需更强隔离，
 *    可将 apiKey 改为云函数环境变量 / 云开发「环境变量」配置，前端不再传 key。
 *  - 免费额度对自用足够；超时/频率限制以云开发控制台为准。
 */

const https = require('https');
const url = require('url');

/**
 * 发起 HTTPS POST 请求（原生模块，无需额外依赖）
 */
function postJson(targetUrl, headers, body) {
  return new Promise((resolve, reject) => {
    const u = url.parse(targetUrl);
    const data = JSON.stringify(body);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.path,
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        headers
      ),
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parsed = { _raw: raw };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(
            new Error(
              '上游返回 ' +
                res.statusCode +
                ': ' +
                (parsed.error && parsed.error.message ? parsed.error.message : raw.substring(0, 300))
            )
          );
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy(new Error('请求超时'));
    });
    req.write(data);
    req.end();
  });
}

/**
 * 入口函数
 */
exports.main = async (event, context) => {
  const { baseUrl, model, apiKey, messages, temperature, test } = event || {};

  if (!baseUrl || !apiKey) {
    return { ok: false, error: '缺少 baseUrl 或 apiKey' };
  }

  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const headers = {
    Authorization: 'Bearer ' + apiKey,
  };

  try {
    if (test) {
      // 连通性测试：只发一句最小请求
      const r = await postJson(endpoint, headers, {
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: '请回复"ok"' }],
        max_tokens: 10,
        temperature: 0,
      });
      return { ok: true, model: r.model || model, content: '' };
    }

    const r = await postJson(endpoint, headers, {
      model: model || 'gpt-4o-mini',
      messages: messages || [],
      temperature: typeof temperature === 'number' ? temperature : 0.3,
      response_format: { type: 'json_object' },
    });

    const content =
      r && r.choices && r.choices[0] && r.choices[0].message
        ? r.choices[0].message.content
        : '';

    if (!content) {
      return { ok: false, error: '上游返回内容为空' };
    }
    return { ok: true, model: r.model || model, content };
  } catch (e) {
    return { ok: false, error: e.message || '云函数执行失败' };
  }
};

/**
 * utils/voice.js
 * 语音录入模块
 * 使用 wx.getRecorderManager 录音
 * 支持上传到配置的 STT 端点进行语音转文字
 */

let recorderManager = null;
let isRecording = false;

/**
 * 初始化录音管理器
 */
const init = () => {
  if (!recorderManager) {
    recorderManager = wx.getRecorderManager();
  }
  return recorderManager;
};

/**
 * 开始录音
 * @param {Function} onStop 录音停止回调 (res) => void，res.tempFilePath 为录音文件
 * @param {Function} onError 录音错误回调
 */
const startRecording = (onStop, onError) => {
  const rm = init();

  rm.onStop((res) => {
    isRecording = false;
    if (onStop) onStop(res);
  });

  rm.onError((err) => {
    isRecording = false;
    if (onError) onError(err);
  });

  rm.start({
    duration: 60000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 48000,
    format: 'mp3',
  });

  isRecording = true;
};

/**
 * 停止录音
 */
const stopRecording = () => {
  if (!recorderManager || !isRecording) return;
  recorderManager.stop();
};

/**
 * 是否正在录音
 */
const getIsRecording = () => isRecording;

/**
 * 检查录音权限
 * @returns {Promise<boolean>}
 */
const checkPermission = () => {
  return new Promise((resolve) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record']) {
          resolve(true);
        } else {
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(true),
            fail: () => resolve(false),
          });
        }
      },
      fail: () => resolve(false),
    });
  });
};

/**
 * 语音转文字
 * @param {string} audioFilePath 录音临时文件路径
 * @param {Object} settings API配置 (sttUrl, apiKey)
 * @returns {Promise<string>} 转换后的文字
 */
const speechToText = (audioFilePath, settings) => {
  return new Promise((resolve, reject) => {
    if (!settings || !settings.sttUrl) {
      reject(new Error('未配置语音转文字端点（STT URL），请在设置中填写'));
      return;
    }

    wx.uploadFile({
      url: settings.sttUrl,
      filePath: audioFilePath,
      name: 'audio',
      header: {
        Authorization: 'Bearer ' + (settings.apiKey || ''),
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data);
            const text = data.text || data.transcript || data.result || '';
            if (text) {
              resolve(text);
            } else {
              reject(new Error('语音转文字结果为空'));
            }
          } catch (e) {
            // 如果返回的不是 JSON，直接用纯文本
            if (res.data && res.data.trim()) {
              resolve(res.data.trim());
            } else {
              reject(new Error('语音转文字返回格式异常'));
            }
          }
        } else {
          reject(new Error('语音转文字失败: HTTP ' + res.statusCode));
        }
      },
      fail: (err) => {
        reject(new Error('语音上传失败: ' + (err.errMsg || '网络错误')));
      },
    });
  });
};

module.exports = {
  init,
  startRecording,
  stopRecording,
  getIsRecording,
  checkPermission,
  speechToText,
};

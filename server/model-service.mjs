export const MODEL_ENDPOINT = 'https://token.agentone.work/v1/chat/completions';
export function networkFailure(error, timeoutMs) {
  const code = error?.cause?.code || error?.code;
  const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
  const reasons = { ENOTFOUND: '接口域名 DNS 解析失败', EAI_AGAIN: '接口域名 DNS 暂时不可用', ECONNRESET: '中转服务连接被重置', ECONNREFUSED: '中转服务拒绝连接', UND_ERR_CONNECT_TIMEOUT: '连接中转服务超时', UND_ERR_HEADERS_TIMEOUT: '等待中转服务响应头超时', ETIMEDOUT: '连接中转服务超时' };
  return Object.assign(Error(timeout ? `模型请求超过 ${timeoutMs / 1000} 秒仍未完成；小图连通测试通过不代表三帧分析能及时返回` : (reasons[code] || '模型网络连接失败，未收到有效响应；请检查中转服务或本机网络')), { status: 502 });
}
export function createModelService({ read, write, fetchImpl = fetch, env = process.env }) {
  const settings = () => {
    const s = read() || { model: env.MODEL_NAME || 'qwen3.8-max', key: env.MODEL_API_KEY || '', vision: false };
    return s.endpoint === MODEL_ENDPOINT ? s : { ...s, endpoint: MODEL_ENDPOINT, vision: false, verified: null };
  };
  const status = () => { const s = settings(); return { provider: 'token.agentone.work', model: s.model, configured: !!s.key, text: !!s.key, vision: !!s.key && s.vision === true, verified: s.verified || null }; };
  async function call(kind, messages, probe = false, options = {}) {
    const s = settings();
    if (!s.key) throw Object.assign(Error('请先配置模型名称和 API Key'), { status: 503 });
    if (kind === 'vision' && !s.vision && !probe) throw Object.assign(Error('图像能力尚未验证，请使用人工标注'), { status: 503 });
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      const timeoutMs = options.timeoutMs || (kind === 'vision' && !probe ? 180000 : 60000);
      try { response = await fetchImpl(MODEL_ENDPOINT, { method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer ' + s.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: s.model, messages, temperature: .2, max_tokens: options.maxTokens || 2048, response_format: { type: 'json_object' } }), signal: options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }); }
      catch (e) {
        const code = e?.cause?.code || e?.code;
        if (attempt === 0 && ['ECONNRESET','EAI_AGAIN'].includes(code)) { await new Promise(r=>setTimeout(r,500)); continue; }
        throw networkFailure(e, timeoutMs);
      }
      if (!response.ok) {
        if (response.status === 524 || response.status === 504) throw Object.assign(Error(`中转服务等待上游模型超时（HTTP ${response.status}）；请稍后重新识别，重复刷新页面不会重发模型请求`), { status: 502 });
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) { await new Promise(r => setTimeout(r, 500)); continue; }
        throw Object.assign(Error('模型接口返回 HTTP ' + response.status + '，请检查模型名称、密钥及额度'), { status: 502 });
      }
      try {
        const data = await response.json(), content = data.choices?.[0]?.message?.content;
        if(data.choices?.[0]?.finish_reason==='length')throw Object.assign(Error('模型输出达到长度上限，未保存不完整结果，请缩短教学目标后重试'),{status:502});
        if (typeof content !== 'string') throw Error();
        const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error();
        return parsed;
      } catch (e) {
        if(e?.status===502)throw e;
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError' || e?.cause?.code) throw networkFailure(e, timeoutMs);
        throw Object.assign(Error('模型返回格式无效，未保存生成结果'), { status: 502 });
      }
    }
  }
  function save(input) {
    if (typeof input.model !== 'string' || !/^[\w./:-]{1,120}$/.test(input.model)) throw Object.assign(Error('模型名称格式无效'), { status: 400 });
    if (typeof input.key !== 'string' || input.key.length > 4096 || /[\r\n]/.test(input.key)) throw Object.assign(Error('API Key 格式无效'), { status: 400 });
    const current=settings();
    const key = input.key.trim() || current.key;
    if(key&&input.model===current.model&&key===current.key)return status();
    if (!key) throw Object.assign(Error('首次配置需要输入 API Key'), { status: 400 });
    write({ model: input.model, key, endpoint: MODEL_ENDPOINT, vision: false }); return status();
  }
  async function test() {
    const prompt = [{ role: 'user', content: '仅返回 JSON：{"ok":true}' }];
    const result = await call('text', prompt);
    if (result.ok !== true) throw Object.assign(Error('文本探测未返回约定结果'), { status: 502 });
    const tested=settings();
    const commit=patch=>{const now=settings();if(now.key!==tested.key||now.model!==tested.model)throw Object.assign(Error('测试期间模型配置已改变，请重新测试'),{status:409});write({...now,...patch,verified:new Date().toISOString()});};
    // 使用本地生成的红色像素探测图像输入；不上传用户素材。
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=';
    try {
      const v = await call('vision', [{ role: 'user', content: [{ type: 'text', text: '识别图片主要颜色。仅返回 JSON，color 为英文小写颜色名称，不确定返回 unknown。' }, { type: 'image_url', image_url: { url: image } }] }], true);
      const vision = v.color === 'red'; commit({vision});
      return { ...status(), message: vision ? '文本及图像探测通过；教学结果仍需教师复核' : '文本探测通过；图像识别未通过，保留人工标注' };
    } catch(e) { if(e.status===409)throw e;commit({vision:false}); return { ...status(), message: '文本探测通过；图像接口未通过，保留人工标注' }; }
  }
  return { status, save, call, test };
}

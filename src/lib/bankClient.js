export class BankClient {
  async contribute() {
    throw new Error('BankClient.contribute 必须由具体平台实现。');
  }
}

export class HttpBankClient extends BankClient {
  constructor({ endpoint, fetchImpl } = {}) {
    super();
    this.endpoint = endpoint?.trim() || '';
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args));
  }

  get configured() {
    return Boolean(this.endpoint);
  }

  contributionUrl() {
    if (!this.endpoint) throw new Error('候选区服务尚未配置。');
    const base = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
    return new URL('v1/contributions', base).toString();
  }

  async contribute(value, { signal } = {}) {
    const response = await this.fetchImpl(this.contributionUrl(), {
      method: 'POST',
      body: JSON.stringify(value),
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      referrerPolicy: 'no-referrer',
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code || `http_${response.status}`;
      throw new Error(`候选区拒绝了这份贡献：${code}`);
    }
    return payload;
  }
}

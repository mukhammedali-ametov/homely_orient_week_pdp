const HomelyAPI = {
  token() {
    return localStorage.getItem("homely_session") || "";
  },
  setToken(token) {
    if (token) localStorage.setItem("homely_session", token);
    else localStorage.removeItem("homely_session");
  },
  async req(path, opts) {
    const options = opts || {};
    const headers = { "Content-Type": "application/json" };
    const token = this.token();
    if (token) headers["X-Session"] = token;
    let res;
    try {
      res = await fetch(path, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (err) {
      const offline = new Error("Server ishlamayapti. homely papkasidagi Homely-ochish.command faylini ikki marta bosing.");
      offline.offline = true;
      throw offline;
    }
    let data = {};
    try { data = await res.json(); } catch (err) { data = {}; }
    if (!res.ok) {
      const error = new Error(data.error || "Xatolik yuz berdi");
      error.status = res.status;
      throw error;
    }
    return data;
  },
  bootstrap() { return this.req("/api/bootstrap"); },
  login(login, password) {
    return this.req("/api/login", { method: "POST", body: { login, password } }).then((data) => {
      this.setToken(data.token);
      return data.user;
    });
  },
  logout() {
    return this.req("/api/logout", { method: "POST", body: {} }).finally(() => this.setToken(""));
  },
  register(body) {
    return this.req("/api/register", { method: "POST", body }).then((data) => {
      this.setToken(data.token);
      return data.user;
    });
  },
  createOrder(body) { return this.req("/api/orders", { method: "POST", body }); },
  orders() { return this.req("/api/orders"); },
  track(number) { return this.req("/api/track?number=" + encodeURIComponent(number)); },
  xabar(token) { return this.req("/api/xabar?t=" + encodeURIComponent(token)); },
  reply(body) { return this.req("/api/reply", { method: "POST", body }); },
  contact(body) { return this.req("/api/contact", { method: "POST", body }); },
  admin() { return this.req("/api/admin"); },
  status(id, status) { return this.req("/api/status", { method: "POST", body: { id, status } }); },
  read() { return this.req("/api/read", { method: "POST", body: {} }); },
  reset() { return this.req("/api/reset", { method: "POST", body: {} }); }
};

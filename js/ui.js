const UI = {
  esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  },
  som(value) {
    const number = Math.round(Number(value) || 0);
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
  },
  niceDate(iso) {
    if (!iso) return "";
    const parts = String(iso).slice(0, 10).split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
    const days = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
    return parts[2] + "-" + months[date.getMonth()] + ", " + days[date.getDay()];
  },
  niceTime(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return date.getDate() + "-" + months[date.getMonth()] + " " + hh + ":" + mm;
  },
  statusName(code) {
    return {
      qabul: "Qabul qilindi",
      qadoq: "Qadoqlandi",
      jonatildi: "Jo'natildi",
      yetib: "Yetib bordi"
    }[code] || code;
  },
  timeline(history, current) {
    const steps = [["qabul", "Qabul qilindi"], ["qadoq", "Qadoqlandi"], ["jonatildi", "Jo'natildi"], ["yetib", "Yetib bordi"]];
    const index = steps.findIndex((step) => step[0] === current);
    return '<ol class="timeline">' + steps.map((step, i) => {
      const hit = (history || []).find((item) => item.status === step[0]);
      const cls = i < index ? "is-done" : i === index ? "is-now" : "";
      const when = hit ? "<small>" + UI.esc(UI.niceTime(hit.at)) + "</small>" : "";
      return '<li class="' + cls + '"><span></span><div><strong>' + step[1] + "</strong>" + when + "</div></li>";
    }).join("") + "</ol>";
  },
  safeImg(src) {
    if (!src || typeof src !== "string") return "";
    if (/^assets\/[a-z0-9.-]+$/i.test(src)) return src;
    if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(src)) return src;
    return "";
  },
  safeAudio(src) {
    if (!src || typeof src !== "string") return "";
    if (!src.startsWith("data:audio/")) return "";
    if (/[<>"']/.test(src)) return "";
    return src;
  },
  drawQr(el, text) {
    if (!el) return;
    try {
      if (typeof qrcode !== "function") throw new Error("qr");
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch (err) {
      el.textContent = text;
    }
  },
  logo() {
    return '<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M6 30 L32 8 L58 30" fill="none" stroke="#2C1E17" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="12" y="28" width="40" height="28" rx="7" fill="#C9772E"/><path d="M32 35.8c-2.4-2.2-6.6-1.1-6.6 2.4 0 3.1 3 5.2 6.6 8 3.6-2.8 6.6-4.9 6.6-8 0-3.5-4.2-4.6-6.6-2.4z" fill="#F8F1EA"/></svg>';
  },
  mount(state) {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    const page = document.body.dataset.page || "";
    const user = state && state.user;
    const unread = ((state && state.notifications) || []).filter((item) => !item.read).length;
    const links = [
      ["home", "index.html", "Bosh sahifa"],
      ["boxes", "qutilar.html", "Qutilar"],
      ["order", "buyurtma.html", "Buyurtma"],
      ["track", "kuzatish.html", "Kuzatish"],
      ["contact", "aloqa.html", "Aloqa"]
    ];
    let actions = '<a class="btn btn-ghost" href="royxat.html">Ro\'yxat</a><a class="btn btn-primary" href="kirish.html">Kirish</a>';
    if (user && user.role === "admin") {
      actions = '<span class="who-name">' + UI.esc(user.name) + '</span><a class="btn btn-primary" href="admin.html">Admin</a><button class="btn btn-ghost" type="button" data-logout>Chiqish</button>';
    } else if (user) {
      const badge = unread ? '<em class="count">' + unread + "</em>" : "";
      actions = '<span class="who-name">' + UI.esc(user.name.split(" ")[0]) + '</span><a class="btn btn-primary" href="kabinet.html">Kabinet ' + badge + '</a><button class="btn btn-ghost" type="button" data-logout>Chiqish</button>';
    }
    if (header) {
      header.innerHTML = '<div class="wrap header-bar"><a class="brand" href="index.html">' + UI.logo() + '<span class="brand-name">Homely</span></a><button class="nav-toggle" type="button" id="nav-toggle" aria-label="Menyu" aria-expanded="false"><span></span><span></span><span></span></button><div class="nav-panel" id="nav-panel"><nav class="nav">' + links.map((link) => {
        const active = link[0] === page || (link[0] === "boxes" && page === "box") ? " is-active" : "";
        return '<a class="nav-link' + active + '" href="' + link[1] + '">' + link[2] + "</a>";
      }).join("") + '</nav><div class="header-actions">' + actions + "</div></div></div>";
      const toggle = document.getElementById("nav-toggle");
      const panel = document.getElementById("nav-panel");
      if (toggle && panel) {
        toggle.addEventListener("click", () => {
          const open = panel.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }
    }
    if (footer) {
      footer.innerHTML = '<div class="wrap footer-grid"><div>' + UI.logo() + '<div class="brand-name">Homely</div><p class="fine">Masofa uzoq. Mehr — yaqin.</p><p class="fine">HTML · CSS · JavaScript</p></div><div><strong>Sahifalar</strong><ul><li><a href="index.html">Bosh sahifa</a></li><li><a href="qutilar.html">Qutilar</a></li><li><a href="buyurtma.html">Buyurtma</a></li><li><a href="kuzatish.html">Kuzatish</a></li><li><a href="aloqa.html">Aloqa</a></li></ul></div><div><strong>Aloqa</strong><p class="fine">Toshkent<br>+998 71 200 00 00<br>Har kuni 09:00–19:00</p></div></div>';
    }
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", async () => {
        try { await HomelyAPI.logout(); } catch (err) { HomelyAPI.setToken(""); }
        location.href = "index.html";
      });
    });
  },
  offline(message) {
    const main = document.getElementById("main") || document.body;
    const box = document.createElement("div");
    box.className = "wrap";
    box.innerHTML = '<div class="banner banner-bad" role="alert">' + UI.esc(message) + "</div>";
    main.prepend(box);
  }
};

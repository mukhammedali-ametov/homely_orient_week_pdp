const Pages = {
  box() {
    const id = new URLSearchParams(location.search).get("id") || "standart";
    const nodes = document.querySelectorAll("[data-box]");
    let found = false;
    nodes.forEach((node) => {
      const on = node.dataset.box === id;
      node.hidden = !on;
      if (on) found = true;
    });
    if (!found && nodes[0]) nodes[0].hidden = false;
    const loading = document.getElementById("box-loading");
    if (loading) loading.hidden = true;
  },

  async order(state) {
    const form = document.getElementById("order-form");
    if (!form) return;
    const boxSelect = document.getElementById("box-id");
    const cityList = document.getElementById("city-list");
    const dateList = document.getElementById("date-list");
    const senderCity = document.getElementById("sender-city");
    const progress = document.getElementById("progress");
    const errorBox = document.getElementById("form-error");
    const backBtn = document.getElementById("back-btn");
    const nextBtn = document.getElementById("next-btn");
    const payBtn = document.getElementById("pay-btn");
    const customWrap = document.getElementById("custom-wrap");
    const who = document.getElementById("who");
    let step = 1;
    let draftPhoto = null;
    let draftAudio = null;
    let recorder = null;
    let recTimer = null;

    const wanted = new URLSearchParams(location.search).get("quti") || "standart";
    boxSelect.innerHTML = state.boxes.map((box) => {
      return '<option value="' + UI.esc(box.id) + '"' + (box.id === wanted ? " selected" : "") + ">" + UI.esc(box.name) + " — " + UI.som(box.price) + "</option>";
    }).join("");

    const countries = [];
    state.routes.forEach((route) => {
      if (!countries.includes(route.country)) countries.push(route.country);
    });
    cityList.innerHTML = countries.map((country) => {
      const items = state.routes.filter((route) => route.country === country).map((route, index) => {
        const checked = route.id === "moskva" || (country !== "Rossiya" && index === 0 && !state.routes.some((item) => item.id === "moskva")) ? " checked" : "";
        return '<label class="choice"><input type="radio" name="route" value="' + UI.esc(route.id) + '"' + (route.id === "moskva" ? " checked" : "") + '><span><strong>' + UI.esc(route.city) + "</strong><small>" + UI.esc(route.country) + " · yetkazish " + UI.som(route.delivery) + " · " + UI.esc(route.days) + "</small></span></label>";
      }).join("");
      return '<p class="group-label">' + UI.esc(country) + "</p>" + items;
    }).join("");

    dateList.innerHTML = state.dates.map((date, index) => {
      return '<label class="choice"><input type="radio" name="shipDate" value="' + UI.esc(date) + '"' + (index === 0 ? " checked" : "") + '><span><strong>' + UI.esc(UI.niceDate(date)) + "</strong><small>Shu kuni hamkor orqali jo'natiladi</small></span></label>";
    }).join("");

    senderCity.innerHTML = state.senderCities.map((city) => {
      const selected = state.user && state.user.city === city ? " selected" : "";
      return '<option' + selected + ">" + UI.esc(city) + "</option>";
    }).join("");

    if (state.user) {
      document.getElementById("sender-name").value = state.user.name || "";
      document.getElementById("sender-phone").value = state.user.phone || "";
      who.innerHTML = '<div class="banner">Siz <strong>' + UI.esc(state.user.name) + "</strong> sifatida kirdingiz. Buyurtma kabinetda saqlanadi.</div>";
    } else {
      const back = "kirish.html?next=" + encodeURIComponent("buyurtma.html" + location.search);
      who.innerHTML = '<div class="banner">Kabinetda ko\'rish uchun <a href="' + back + '">kiring</a>. Mehmon ham buyurtma bera oladi.</div>';
    }

    const steps = ["Manzil", "Sana", "Mehr", "To'lov"];
    function setError(text) { errorBox.textContent = text || ""; }
    function selectedBox() { return state.boxes.find((box) => box.id === boxSelect.value) || state.boxes[0]; }
    function selectedRoute() {
      const id = (document.querySelector('input[name="route"]:checked') || {}).value;
      return state.routes.find((route) => route.id === id) || state.routes[0];
    }
    function selectedDate() {
      return (document.querySelector('input[name="shipDate"]:checked') || {}).value || "";
    }
    function renderMini() {
      const box = selectedBox();
      customWrap.hidden = box.id !== "ozim";
      document.getElementById("box-mini").innerHTML = '<div class="mini-box"><img src="' + UI.esc(box.image) + '" alt=""><div><strong>' + UI.esc(box.name) + "</strong><div>" + UI.som(box.price) + "</div><small>" + UI.esc(box.lead) + "</small></div></div>";
    }
    function renderSummary() {
      const box = selectedBox();
      const route = selectedRoute();
      const total = box.price + route.delivery;
      document.getElementById("pay-summary").innerHTML = '<div><span>' + UI.esc(box.name) + "</span><span>" + UI.som(box.price) + "</span></div><div><span>Yetkazish · " + UI.esc(route.city) + "</span><span>" + UI.som(route.delivery) + '</span></div><div class="total"><span>Jami</span><span>' + UI.som(total) + "</span></div><p class='hint'>Yetkazish narxi hamkor tarifi. Homely logistika kompaniyasi emas.</p>";
    }
    function showStep(next) {
      step = next;
      document.querySelectorAll("[data-step]").forEach((el) => {
        el.hidden = Number(el.dataset.step) !== next;
      });
      backBtn.hidden = next === 1;
      nextBtn.hidden = next === 4;
      payBtn.hidden = next !== 4;
      progress.innerHTML = steps.map((label, index) => {
        const cls = index + 1 === next ? "is-on" : index + 1 < next ? "is-done" : "";
        return '<li class="' + cls + '">' + label + "</li>";
      }).join("");
      if (next === 4) renderSummary();
      setError("");
    }
    function validate(current) {
      if (current === 1) {
        if (document.getElementById("recipient").value.trim().length < 2) return "Qabul qiluvchining ismini yozing";
        if (!document.querySelector('input[name="route"]:checked')) return "Shaharni tanlang";
        if (selectedBox().id === "ozim" && document.getElementById("custom-note").value.trim().length < 3) return "Nima topshirayotganingizni qisqa yozing";
      }
      if (current === 2 && !selectedDate()) return "Jo'natish sanasini tanlang";
      if (current === 3 && document.getElementById("message").value.trim().length < 3) return "Mehr xabarini yozing. Farzand qutini ochishdan oldin shuni ko'radi.";
      return "";
    }

    boxSelect.addEventListener("change", renderMini);
    document.getElementById("fill-sardor").addEventListener("click", () => {
      document.getElementById("recipient").value = "Sardor Karimov";
      const moskva = document.querySelector('input[name="route"][value="moskva"]');
      if (moskva) moskva.checked = true;
    });
    document.getElementById("fill-message").addEventListener("click", () => {
      document.getElementById("message").value = "O'g'lim, seni sog'indik. Bu mayizni o'zimiz tayyorladik.";
    });
    document.getElementById("fill-card").addEventListener("click", () => {
      const senderInput = document.getElementById("sender-name");
      const phoneInput = document.getElementById("sender-phone");
      if (!senderInput.value.trim()) senderInput.value = (state.user && state.user.name) || "Zulfiya Karimova";
      if (!phoneInput.value.trim()) phoneInput.value = (state.user && state.user.phone) || "+998 90 555 12 34";
      document.getElementById("card-name").value = senderInput.value.trim();
      document.getElementById("card-number").value = "8600 1234 5678 9012";
      document.getElementById("card-expiry").value = "12/28";
      document.getElementById("card-cvv").value = "123";
    });
    document.getElementById("card-number").addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 16);
      event.target.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    });
    document.getElementById("card-expiry").addEventListener("input", (event) => {
      let digits = event.target.value.replace(/\D/g, "").slice(0, 4);
      if (digits.length >= 3) digits = digits.slice(0, 2) + "/" + digits.slice(2);
      event.target.value = digits;
    });
    document.getElementById("photo").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        draftPhoto = await compressImage(file);
        const preview = document.getElementById("photo-preview");
        preview.src = draftPhoto;
        preview.hidden = false;
      } catch (err) {
        setError(err.message || "Rasm ochilmadi");
      }
    });
    document.getElementById("rec-btn").addEventListener("click", async () => {
      const button = document.getElementById("rec-btn");
      const label = document.getElementById("rec-state");
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
        setError("Bu brauzerda ovoz yozib bo'lmaydi. Matn yozing.");
        return;
      }
      if (recorder && recorder.state === "recording") {
        recorder.stop();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          clearInterval(recTimer);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (blob.size > 700000) {
            setError("Ovoz juda uzun. Qisqaroq yozing.");
            button.textContent = "Ovoz yozish";
            return;
          }
          draftAudio = await blobToData(blob);
          const audio = document.getElementById("audio-preview");
          audio.src = draftAudio;
          audio.hidden = false;
          label.textContent = "Ovoz tayyor";
          button.textContent = "Qayta yozish";
        };
        recorder.start();
        button.textContent = "To'xtatish";
        let seconds = 0;
        label.textContent = "Yozilmoqda... 0s";
        recTimer = setInterval(() => {
          seconds += 1;
          label.textContent = "Yozilmoqda... " + seconds + "s";
          if (seconds >= 20 && recorder && recorder.state === "recording") recorder.stop();
        }, 1000);
      } catch (err) {
        setError("Mikrofonga ruxsat berilmadi. Matn bilan davom eting.");
      }
    });

    function goNext() {
      const problem = validate(step);
      if (problem) { setError(problem); return; }
      showStep(step + 1);
    }
    nextBtn.addEventListener("click", goNext);
    backBtn.addEventListener("click", () => showStep(step - 1));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (step < 4) { goNext(); return; }
      const problem = validate(3) || validate(1) || validate(2);
      if (problem) { setError(problem); return; }
      const card = document.getElementById("card-number").value.replace(/\D/g, "");
      const body = {
        boxId: selectedBox().id,
        routeId: selectedRoute().id,
        shipDate: selectedDate(),
        recipientName: document.getElementById("recipient").value.trim(),
        messageText: document.getElementById("message").value.trim(),
        messagePhoto: draftPhoto,
        messageAudio: draftAudio,
        customNote: document.getElementById("custom-note").value.trim(),
        senderName: document.getElementById("sender-name").value.trim(),
        senderPhone: document.getElementById("sender-phone").value.trim(),
        senderCity: senderCity.value,
        cardName: document.getElementById("card-name").value.trim(),
        cardNumber: card,
        expiry: document.getElementById("card-expiry").value.trim(),
        cvv: document.getElementById("card-cvv").value.trim()
      };
      payBtn.disabled = true;
      payBtn.textContent = "To'lanmoqda...";
      setError("");
      try {
        const [result] = await Promise.all([
          HomelyAPI.createOrder(body),
          new Promise((resolve) => setTimeout(resolve, 700))
        ]);
        showDone(result.order, state);
      } catch (err) {
        setError(err.message);
        payBtn.disabled = false;
        payBtn.textContent = "To'lash";
      }
    });

    renderMini();
    showStep(1);
  },

  async track() {
    const form = document.getElementById("track-form");
    const input = document.getElementById("track-number");
    const result = document.getElementById("track-result");
    async function search(number) {
      result.innerHTML = "<p>Qidirilmoqda...</p>";
      try {
        const data = await HomelyAPI.track(number);
        result.innerHTML = orderCard(data.order, data.order.token ? "owner" : "track");
      } catch (err) {
        result.innerHTML = '<div class="banner banner-bad">' + UI.esc(err.message) + "</div>";
      }
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      search(input.value.trim());
    });
    const preset = new URLSearchParams(location.search).get("number");
    if (preset) {
      input.value = preset;
      search(preset);
    }
  },

  contact() {
    const form = document.getElementById("contact-form");
    const ok = document.getElementById("contact-ok");
    const error = document.getElementById("contact-error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        await HomelyAPI.contact({
          name: document.getElementById("c-name").value.trim(),
          phone: document.getElementById("c-phone").value.trim(),
          message: document.getElementById("c-message").value.trim()
        });
        form.hidden = true;
        ok.hidden = false;
      } catch (err) {
        error.textContent = err.message;
        button.disabled = false;
      }
    });
  },

  login(state) {
    if (state.user) {
      location.href = state.user.role === "admin" ? "admin.html" : "kabinet.html";
      return;
    }
    const form = document.getElementById("login-form");
    const error = document.getElementById("login-error");
    async function enter(login, password) {
      error.textContent = "";
      try {
        const user = await HomelyAPI.login(login, password);
        const next = new URLSearchParams(location.search).get("next") || "";
        if (/^[a-z]+\.html(\?[a-z0-9=&%._-]*)?$/i.test(next)) location.href = next;
        else location.href = user.role === "admin" ? "admin.html" : "kabinet.html";
      } catch (err) {
        error.textContent = err.message;
      }
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      enter(document.getElementById("login").value.trim(), document.getElementById("password").value);
    });
    document.querySelectorAll("[data-demo]").forEach((button) => {
      button.addEventListener("click", () => enter(button.dataset.login, button.dataset.password));
    });
  },

  register(state) {
    if (state.user) {
      location.href = "kabinet.html";
      return;
    }
    const form = document.getElementById("register-form");
    const error = document.getElementById("register-error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const password = document.getElementById("r-password").value;
      if (password !== document.getElementById("r-password2").value) {
        error.textContent = "Parollar bir xil emas";
        return;
      }
      try {
        await HomelyAPI.register({
          name: document.getElementById("r-name").value.trim(),
          phone: document.getElementById("r-phone").value.trim(),
          city: document.getElementById("r-city").value,
          login: document.getElementById("r-login").value.trim(),
          password
        });
        location.href = "kabinet.html";
      } catch (err) {
        error.textContent = err.message;
      }
    });
  },

  async cabinet(state) {
    const root = document.getElementById("cabinet");
    if (!state.user) {
      location.href = "kirish.html?next=kabinet.html";
      return;
    }
    if (state.user.role === "admin") {
      location.href = "admin.html";
      return;
    }
    try {
      await HomelyAPI.read();
      (state.notifications || []).forEach((note) => { note.read = true; });
      UI.mount(state);
    } catch (err) { /* xabarlar ochiq qoladi */ }
    let orders = [];
    try {
      const data = await HomelyAPI.orders();
      orders = data.orders || [];
    } catch (err) {
      root.innerHTML = '<div class="banner banner-bad">' + UI.esc(err.message) + "</div>";
      return;
    }
    const notes = state.notifications || [];
    root.innerHTML = '<p class="eyebrow">Kabinet</p><h1 class="page-title">Salom, ' + UI.esc(state.user.name.split(" ")[0]) + '</h1><p class="lede">Buyurtmalaringiz va farzanddan kelgan javob shu yerda.</p><p><a class="btn btn-primary" href="buyurtma.html">Yangi buyurtma</a></p>' +
      (notes.length ? '<div class="panel"><h2>Xabarlar</h2>' + notes.map((note) => '<p><strong>' + UI.esc(note.text) + "</strong><br><small>" + UI.esc(UI.niceTime(note.at)) + "</small></p>").join("") + "</div>" : "") +
      (orders.length ? orders.map((order) => orderCard(order, "owner")).join("") : '<div class="panel"><p>Hali buyurtma yo\'q. Birinchi qutini yuboring.</p><a class="btn btn-primary" href="qutilar.html">Quti tanlash</a></div>');
  },

  async admin(state) {
    const root = document.getElementById("admin");
    if (!state.user) {
      location.href = "kirish.html?next=admin.html";
      return;
    }
    if (state.user.role !== "admin") {
      location.href = "kabinet.html";
      return;
    }
    let data;
    try { data = await HomelyAPI.admin(); }
    catch (err) {
      root.innerHTML = '<div class="banner banner-bad">' + UI.esc(err.message) + "</div>";
      return;
    }
    const orders = data.orders || [];
    const sum = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    const fresh = orders.filter((order) => order.status === "qabul").length;
    root.innerHTML = '<p class="eyebrow">Admin</p><h1 class="page-title">Boshqaruv</h1><div class="stats"><div class="stat"><span>Buyurtma</span><b>' + orders.length + '</b></div><div class="stat"><span>Jami to\'lov</span><b>' + UI.som(sum) + '</b></div><div class="stat"><span>Yangi</span><b>' + fresh + '</b></div><div class="stat"><span>Murojaat</span><b>' + (data.contacts || []).length + '</b></div></div><div class="tabs"><button class="btn btn-ghost is-on" type="button" data-tab="orders">Buyurtmalar</button><button class="btn btn-ghost" type="button" data-tab="contacts">Murojaatlar</button><button class="btn btn-ghost" type="button" data-tab="users">Foydalanuvchilar</button></div><div id="tab-orders"></div><div id="tab-contacts" hidden></div><div id="tab-users" hidden></div><p><button class="btn btn-ghost" type="button" id="reset-btn">Namoyishni boshiga qaytarish</button></p>';
    document.getElementById("tab-orders").innerHTML = orders.map((order) => orderCard(order, "admin")).join("") || "<p>Buyurtma yo'q</p>";
    document.getElementById("tab-contacts").innerHTML = (data.contacts || []).map((item) => {
      return '<article class="panel"><strong>' + UI.esc(item.name) + "</strong> · " + UI.esc(item.phone) + "<br><small>" + UI.esc(UI.niceTime(item.at)) + '</small><p class="note">' + UI.esc(item.message) + "</p></article>";
    }).join("") || "<p>Murojaat yo'q</p>";
    document.getElementById("tab-users").innerHTML = '<table class="user-table"><thead><tr><th>Ism</th><th>Login</th><th>Telefon</th><th>Rol</th><th>Buyurtma</th></tr></thead><tbody>' + (data.users || []).map((user) => {
      return "<tr><td>" + UI.esc(user.name) + "</td><td>" + UI.esc(user.login) + "</td><td>" + UI.esc(user.phone) + "</td><td>" + UI.esc(user.role === "admin" ? "Admin" : "Foydalanuvchi") + "</td><td>" + user.orders + "</td></tr>";
    }).join("") + "</tbody></table>";
    root.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-tab]").forEach((item) => item.classList.remove("is-on"));
        button.classList.add("is-on");
        ["orders", "contacts", "users"].forEach((name) => {
          document.getElementById("tab-" + name).hidden = button.dataset.tab !== name;
        });
      });
    });
    root.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await HomelyAPI.status(button.dataset.id, button.dataset.status);
          location.reload();
        } catch (err) {
          alert(err.message);
          button.disabled = false;
        }
      });
    });
    document.getElementById("reset-btn").addEventListener("click", async () => {
      if (!confirm("Barcha buyurtmalar boshlang'ich holatga qaytadi. Davom etasizmi?")) return;
      await HomelyAPI.reset();
      location.reload();
    });
  },

  async message() {
    const root = document.getElementById("letter");
    const token = new URLSearchParams(location.search).get("t") || "";
    if (!token) {
      root.innerHTML = '<div class="banner banner-bad">Shaxsiy havola topilmadi.</div>';
      return;
    }
    let data;
    try { data = await HomelyAPI.xabar(token); }
    catch (err) {
      root.innerHTML = '<div class="letter"><div class="banner banner-bad">' + UI.esc(err.message) + "</div></div>";
      return;
    }
    const photo = UI.safeImg(data.messagePhoto);
    const audio = UI.safeAudio(data.messageAudio);
    const replyPhoto = UI.safeImg(data.replyPhoto);
    root.innerHTML = '<article class="letter"><p class="eyebrow">Onangizdan xabar</p><h1>' + UI.esc(firstName(data.recipientName)) + '</h1><p>' + UI.esc(data.senderName) + (data.senderCity ? " · " + UI.esc(data.senderCity) : "") + "</p><blockquote>" + UI.esc(data.messageText) + "</blockquote>" +
      (photo ? '<img src="' + photo + '" alt="Yuborilgan rasm">' : "") +
      (audio ? '<audio controls src="' + audio + '"></audio>' : "") +
      "<p><strong>" + UI.esc(data.boxName) + "</strong> · " + UI.esc(data.city) + ", " + UI.esc(data.country) + "</p>" +
      UI.timeline(data.history, data.status) +
      (data.replyText ? '<div class="banner banner-ok"><strong>Javobingiz yuborildi.</strong><p>' + UI.esc(data.replyText) + "</p>" + (replyPhoto ? '<img src="' + replyPhoto + '" alt="">' : "") + "</div>" : replyForm()) +
      "</article>";
    const form = document.getElementById("reply-form");
    if (!form) return;
    let replyPhotoData = null;
    document.getElementById("reply-sample").addEventListener("click", () => {
      document.getElementById("reply-text").value = "Onajon, quti yetib keldi. Rahmat, sog'indim.";
    });
    document.getElementById("reply-photo").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        replyPhotoData = await compressImage(file);
        const preview = document.getElementById("reply-preview");
        preview.src = replyPhotoData;
        preview.hidden = false;
      } catch (err) {
        document.getElementById("reply-error").textContent = err.message;
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const error = document.getElementById("reply-error");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await HomelyAPI.reply({ token, text: document.getElementById("reply-text").value.trim(), photo: replyPhotoData });
        location.reload();
      } catch (err) {
        error.textContent = err.message;
        button.disabled = false;
      }
    });
  }
};

function firstName(name) {
  return String(name || "").split(" ")[0];
}

function replyForm() {
  return '<form id="reply-form"><h2>Onangizga javob</h2><p class="hint">Javob yuborilishi bilan ona "Yetib keldi" xabarini oladi.</p><label class="field">Xabar<textarea id="reply-text" rows="4" placeholder="Onajon, quti yetib keldi..."></textarea></label><button class="text-btn" id="reply-sample" type="button">Namuna javob</button><div class="file-row"><label class="file-btn">Rasm qo\'shish<input id="reply-photo" type="file" accept="image/*" hidden></label></div><img id="reply-preview" alt="" hidden><p id="reply-error" class="form-error"></p><button class="btn btn-primary" type="submit">Javob yuborish</button></form>';
}

function orderCard(order, mode) {
  const link = order.token ? '<p><a class="btn btn-primary" href="xabar.html?t=' + encodeURIComponent(order.token) + '">Shaxsiy xabar</a> <a class="btn btn-ghost" href="kuzatish.html?number=' + encodeURIComponent(order.number) + '">Kuzatish</a></p>' : "";
  const message = mode !== "track" && order.messageText ? "<p class=\"quote\" style=\"font-size:22px\">" + UI.esc(order.messageText) + "</p>" : "";
  const photo = mode !== "track" && UI.safeImg(order.messagePhoto) ? '<img src="' + UI.safeImg(order.messagePhoto) + '" alt="" style="border-radius:16px;max-height:220px;object-fit:cover">' : "";
  const reply = order.replyText ? '<div class="banner banner-ok"><strong>Javob:</strong> ' + UI.esc(order.replyText) + "</div>" : "";
  const admin = mode === "admin" ? '<div class="status-row">' + ["qabul", "qadoq", "jonatildi", "yetib"].map((code) => {
    const current = order.status === code ? " is-current" : "";
    return '<button class="btn btn-ghost' + current + '" type="button" data-status="' + code + '" data-id="' + UI.esc(order.id) + '">' + UI.statusName(code) + "</button>";
  }).join("") + "</div>" : "";
  const phone = mode === "admin" && order.senderPhone ? "<br><small>" + UI.esc(order.senderPhone) + " · karta *" + UI.esc(order.cardLast4 || "") + "</small>" : "";
  return '<article class="panel order-card"><div class="order-top"><div><p class="number">' + UI.esc(order.number) + '</p><strong>' + UI.esc(order.boxName) + "</strong><br>" + UI.esc(order.senderName) + " → " + UI.esc(order.recipientName) + "<br>" + UI.esc(order.city) + ", " + UI.esc(order.country) + " · " + UI.esc(UI.niceDate(order.shipDate)) + phone + '</div><span class="badge ' + UI.esc(order.status) + '">' + UI.statusName(order.status) + "</span></div>" + message + photo + reply + UI.timeline(order.history, order.status) + "<p><strong>" + UI.som(order.total) + "</strong> <span class=\"hint\">quti " + UI.som(order.boxPrice) + " + yetkazish " + UI.som(order.deliveryPrice) + "</span></p>" + link + admin + "</article>";
}

function showDone(order, state) {
  document.getElementById("order-form").hidden = true;
  document.getElementById("wizard-nav").hidden = true;
  const done = document.getElementById("done");
  const phoneUrl = String(state.baseUrl || location.origin).replace(/\/$/, "") + "/xabar.html?t=" + encodeURIComponent(order.token);
  const hereUrl = location.origin + "/xabar.html?t=" + encodeURIComponent(order.token);
  done.hidden = false;
  done.innerHTML = '<p class="eyebrow">To\'lov qabul qilindi</p><h2>Buyurtma raqami</h2><p class="number">' + UI.esc(order.number) + '</p><p>' + UI.esc(order.recipientName) + " uchun " + UI.esc(order.boxName) + ". Holat: Qabul qilindi.</p><div class=\"done-grid\"><div class=\"qr-box\" id=\"qr\"></div><div><p>Qutidagi shaxsiy QR. Farzand skanerlasa, onasining xabari ochiladi. Begona bu havolani ko'ra olmaydi.</p><a class=\"btn btn-primary\" href=\"" + hereUrl + "\">Farzand ko'rinishini ochish</a><label class=\"field\">Telefon uchun havola<input class=\"link-box\" readonly value=\"" + UI.esc(phoneUrl) + "\"></label></div></div>";
  UI.drawQr(document.getElementById("qr"), phoneUrl);
  done.scrollIntoView({ behavior: "smooth", block: "start" });
}

function blobToData(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Fayl o'qilmadi"));
    reader.readAsDataURL(blob);
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const max = 960;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.72;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 750000 && quality > 0.45) {
        quality -= 0.08;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 880000) {
        reject(new Error("Rasm juda katta. Boshqa rasm tanlang."));
        return;
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasm ochilmadi"));
    };
    image.src = url;
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page || "";
  let state = null;
  try {
    state = await HomelyAPI.bootstrap();
  } catch (err) {
    UI.mount(null);
    UI.offline(err.message);
    return;
  }
  UI.mount(state);
  const fn = Pages[page];
  if (!fn) return;
  try {
    await fn(state);
  } catch (err) {
    UI.offline(err.message);
  }
});

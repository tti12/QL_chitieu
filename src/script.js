/* ============================================================
   GLOBAL / HELPERS
   - expenses: mỗi phần tử có { id, name, amount, date, createdAt }
   - lưu key: "expenses_<username>"
======================================f====================== */
let expenses = [];
let alertTimeoutId = null;

function getCurrentUser() {
  return localStorage.getItem("loggedInUser");
}

function getExpenseKey() {
  const u = getCurrentUser();
  return u ? `expenses_${u}` : null;
}

function showAlert(message) {
  const box = document.getElementById("alertBox");
  const msg = document.getElementById("alertMessage");
  msg.innerText = message;
  box.classList.remove("hidden");

  // clear previous timeout nếu có
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
  }
  alertTimeoutId = setTimeout(() => {
    box.classList.add("hidden");
    alertTimeoutId = null;
  }, 3500);
}

document.getElementById && document.getElementById("alertClose")?.addEventListener("click", () => {
  document.getElementById("alertBox").classList.add("hidden");
  if (alertTimeoutId) { clearTimeout(alertTimeoutId); alertTimeoutId = null; }
});

/* ============================================================
   AUTH (register/login/logout)
============================================================ */
/* (Đã loại bỏ: legacy local-only user storage).
   Giao tiếp auth giờ dùng backend qua `registerRemote` / `doLoginRemote`.
*/

// ----------------------------
// Remote auth helpers (backend)
// ----------------------------
const API_BASE = window.API_BASE || 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('token');
}

function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(API_BASE + path, Object.assign({}, opts, { headers }))
    .then(async res => {
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
      if (!res.ok) {
        const err = (data && (data.error || data.message)) || (data && data.raw) || res.statusText;
        throw new Error(err);
      }
      return data;
    });
}

function setLoggedIn(username, token) {
  if (token) localStorage.setItem('token', token);
  if (username) localStorage.setItem('loggedInUser', username);
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('loggedInUser');
}

async function doLoginRemote(username, password) {
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setLoggedIn(data.user.username, data.token);
    showAlert('Đăng nhập thành công!');
    setTimeout(()=> {
      showMainForUser(data.user.username);
      loadUserExpenses();
    }, 300);
  } catch (err) {
    showAlert(err.message || 'Lỗi đăng nhập');
  }
}

async function registerRemote(username, password, extra = {}) {
  try {
    const payload = Object.assign({ username, password }, extra);
    const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    // As per UX: show success alert then flip back to login (do not auto-login)
    showAlert('Đăng ký thành công! Mời đăng nhập.');
    setTimeout(()=> document.getElementById('authCard').classList.remove('flip'), 800);
    return data;
  } catch (err) {
    showAlert(err.message || 'Lỗi đăng ký');
    throw err;
  }
}

function doLogout() {
  clearAuth();
  // show auth
  document.querySelector('.auth-wrapper').classList.remove('hidden');
  document.getElementById('main').classList.add('hidden');
  document.body.classList.add('center-body');
  // reset auth card
  document.getElementById('authCard').classList.remove('flip');
  showAlert('Đăng xuất thành công!');
}

/* ============================================================
   EXPENSE STORAGE
============================================================ */
function loadUserExpenses() {
  const token = getToken();
  const key = getExpenseKey();
  if (token) {
    // load from server
    apiFetch('/expenses').then(data => {
      expenses = (data && data.expenses) ? data.expenses : [];
      renderExpenses();
      updateTotals();
    }).catch(err => {
      // fallback to local storage if server call fails
      try {
        expenses = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (e) { expenses = []; }
      renderExpenses();
      updateTotals();
    });
    return;
  }
  // fallback: local-only
  if (!key) return;
  try {
    expenses = JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {
    expenses = [];
  }
  renderExpenses();
  updateTotals();
}

function saveUserExpenses() {
  const token = getToken();
  const key = getExpenseKey();
  if (token) {
    // no-op: server is source of truth for logged-in users
    return;
  }
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(expenses));
}

/* ============================================================
   THÊM CHI TIÊU
============================================================ */
function addExpense() {
  const nameEl = document.getElementById("expenseNameInput");
  const amountEl = document.getElementById("expenseInput");
  const dateEl = document.getElementById("dateInput");

  const name = nameEl.value.trim();
  const amount = parseFloat(amountEl.value);
  const date = dateEl.value;

  if (!getCurrentUser()) {
    showAlert("Vui lòng đăng nhập trước!");
    return;
  }

  if (!name || isNaN(amount) || !date) {
    showAlert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }

  const token = getToken();
  if (token) {
    // send to server
    apiFetch('/expenses', { method: 'POST', body: JSON.stringify({ name, amount: Math.abs(amount), date }) })
      .then(resp => {
        nameEl.value = "";
        amountEl.value = "";
        // reload
        loadUserExpenses();
        showAlert('Thêm chi tiêu thành công!');
      }).catch(err => {
        showAlert(err.message || 'Lỗi thêm chi tiêu');
      });
    return;
  }

  const item = {
    id: Date.now().toString() + Math.random().toString(36).slice(2,7),
    name,
    amount: Math.abs(amount),
    date,
    createdAt: new Date().toISOString()
  };

  expenses.push(item);
  saveUserExpenses();

  nameEl.value = "";
  amountEl.value = "";
  // giữ date mặc định là hôm nay

  renderExpenses();
  updateTotals();
  showAlert("Thêm chi tiêu thành công!");
}

/* ============================================================
   RENDER
   - group theo date, sắp xếp date giảm dần (mới -> cũ)
   - mỗi item có nút xóa dùng id
============================================================ */
function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  if (!expenses.length) {
    list.innerHTML = "<p>Chưa có khoản chi nào.</p>";
    return;
  }

  // group by date
  const group = {};
  expenses.forEach(exp => {
    if (!group[exp.date]) group[exp.date] = [];
    group[exp.date].push(exp);
  });

  // sort dates desc
  const dates = Object.keys(group).sort((a,b) => b.localeCompare(a));

  dates.forEach(date => {
    const arr = group[date];
    // sort items by createdAt (new -> old)
    arr.sort((x,y) => y.createdAt.localeCompare(x.createdAt));

    const [y,m,d] = date.split("-");
    const formatted = `${d}-${m}-${y}`;

    const box = document.createElement("div");
    box.className = "day-container";

    const dateCol = document.createElement("div");
    dateCol.className = "date-col";
    dateCol.innerHTML = `<h3 class="day-title">${formatted}</h3>`;

    const expCol = document.createElement("div");
    expCol.className = "expenses-col";

    arr.forEach(exp => {
      const row = document.createElement("div");
      row.className = "expense-item";
      row.setAttribute("data-id", exp.id);

      const left = document.createElement("div");
      left.className = "exp-left";
      left.innerText = exp.name;

      const right = document.createElement("div");
      right.className = "exp-right";
      right.innerText = exp.amount.toLocaleString("vi-VN") + "đ";

      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.setAttribute("aria-label","Xóa");
      delBtn.innerHTML = `<i class="fas fa-trash"></i>`;
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        confirmDelete(exp.id);
      });

      row.appendChild(left);
      row.appendChild(right);
      row.appendChild(delBtn);

      expCol.appendChild(row);
    });

    box.appendChild(dateCol);
    box.appendChild(expCol);
    list.appendChild(box);
  });
}

/* ============================================================
   XÓA (dùng id)
   - confirm dialog rõ ràng, handlers replace (ko chồng)
============================================================ */
let _pendingDeleteId = null;

function confirmDelete(id) {
  _pendingDeleteId = id;
  const box = document.getElementById("confirmBox");
  box.classList.remove("hidden");
  box.setAttribute("aria-hidden", "false");
}

document.getElementById("confirmYes").addEventListener("click", () => {
  if (!_pendingDeleteId) return;
  const token = getToken();
  if (token) {
    apiFetch('/expenses/' + _pendingDeleteId, { method: 'DELETE' })
      .then(() => {
        loadUserExpenses();
        showAlert('Xóa thành công!');
      }).catch(err => {
        showAlert(err.message || 'Lỗi xóa');
      });
  } else {
    const idx = expenses.findIndex(e => e.id === _pendingDeleteId);
    if (idx !== -1) {
      expenses.splice(idx, 1);
      saveUserExpenses();
      renderExpenses();
      updateTotals();
      showAlert("Xóa thành công!");
    }
  }
  _pendingDeleteId = null;
  document.getElementById("confirmBox").classList.add("hidden");
  document.getElementById("confirmBox").setAttribute("aria-hidden", "true");
});

document.getElementById("confirmNo").addEventListener("click", () => {
  _pendingDeleteId = null;
  document.getElementById("confirmBox").classList.add("hidden");
  document.getElementById("confirmBox").setAttribute("aria-hidden", "true");
});

/* ============================================================
   TOTALS
============================================================ */
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function getMonth() {
  return new Date().toISOString().slice(0,7);
}

function updateTotals() {
  const today = getToday();
  const month = getMonth();

  const todayTotal = expenses.filter(e => e.date === today).reduce((s,e)=>s + (e.amount||0),0);
  const monthTotal = expenses.filter(e => e.date.startsWith(month)).reduce((s,e)=>s + (e.amount||0),0);

  document.getElementById("todayTotal").innerText = todayTotal.toLocaleString("vi-VN") + "đ";
  document.getElementById("monthTotal").innerText = monthTotal.toLocaleString("vi-VN") + "đ";
}

/* ============================================================
   UI / EVENTS BIND ON LOAD
============================================================ */
function showMainForUser(username) {
  document.querySelector(".auth-wrapper").classList.add("hidden");
  document.getElementById("main").classList.remove("hidden");
  document.body.classList.remove("center-body");
  document.getElementById("userLabel").innerText = username;
}

window.addEventListener("DOMContentLoaded", () => {
  // bind auth flip
  const authCard = document.getElementById("authCard");
  document.getElementById("toRegister").addEventListener("click", () => authCard.classList.add("flip"));
  document.getElementById("toLogin").addEventListener("click", () => authCard.classList.remove("flip"));

  // bind auth actions
  document.getElementById("regBtn").addEventListener("click", () => {
    const user = document.getElementById("regUser").value.trim();
    const pass = document.getElementById("regPass").value.trim();
    const name = document.getElementById("regName")?.value?.trim() || null;
    const email = document.getElementById("regEmail")?.value?.trim() || null;
    if (!user || !pass) { showAlert("Vui lòng nhập đầy đủ thông tin!"); return; }
    registerRemote(user, pass, { name, email }).then(()=> {
      document.getElementById("regUser").value = "";
      document.getElementById("regPass").value = "";
      if (document.getElementById("regName")) document.getElementById("regName").value = "";
      if (document.getElementById("regEmail")) document.getElementById("regEmail").value = "";
    }).catch(() => {});
  });

  document.getElementById("loginBtn").addEventListener("click", () => {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    if (!user || !pass) { showAlert("Vui lòng nhập đầy đủ thông tin!"); return; }
    doLoginRemote(user, pass);
  });

  document.getElementById("logoutBtn").addEventListener("click", doLogout);

  document.getElementById("addExpenseBtn").addEventListener("click", addExpense);

  // set date input default to today
  const dateInput = document.getElementById("dateInput");
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }

  // if token exists, validate with backend and load user
  const token = getToken();
  if (token) {
    apiFetch('/auth/me').then(data => {
      const uname = data?.user?.username;
      if (uname) {
        setLoggedIn(uname, token);
        showMainForUser(uname);
        loadUserExpenses();
        return;
      }
      // fallthrough to show auth
      clearAuth();
      document.querySelector('.auth-wrapper').classList.remove('hidden');
      document.getElementById('main').classList.add('hidden');
      document.body.classList.add('center-body');
    }).catch(() => {
      clearAuth();
      document.querySelector('.auth-wrapper').classList.remove('hidden');
      document.getElementById('main').classList.add('hidden');
      document.body.classList.add('center-body');
    });
  } else {
    // check legacy local-only login key
    const user = getCurrentUser();
    if (user) {
      showMainForUser(user);
      loadUserExpenses();
    } else {
      // show auth
      document.querySelector('.auth-wrapper').classList.remove('hidden');
      document.getElementById('main').classList.add('hidden');
      document.body.classList.add('center-body');
    }
  }
});

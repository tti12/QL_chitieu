// ==================== LẤY PHẦN TỬ ====================
const goalForm = document.getElementById("goalForm");
const goalList = document.getElementById("goalList");
const expenseAlert = document.getElementById("expenseAlert");
const expenseProgress = document.getElementById("expenseProgress");
const alertMessage = document.getElementById("alertMessage");
const totalExpenseDisplay = document.getElementById("totalExpenseDisplay");
const budgetDisplay = document.getElementById("budgetDisplay");
const largeExpensesList = document.getElementById("largeExpensesList");

const monthlyBudgetInput = document.getElementById("monthlyBudgetInput");
const setBudgetBtn = document.getElementById("setBudgetBtn");

// Lấy user hiện tại
const currentUser = localStorage.getItem("loggedInUser");

// Lấy danh sách chi tiêu user hiện tại
let expenses = JSON.parse(localStorage.getItem("expenses_" + currentUser) || "[]");

// Ngân sách tháng (mặc định hoặc từ localStorage)
let monthlyBudget = Number(localStorage.getItem("monthlyBudget_" + currentUser)) || 5000000;

// Load mục tiêu tiết kiệm từ localStorage
let goals = JSON.parse(localStorage.getItem("savingGoals")) || [];

// ==================== HIỂN THỊ DANH SÁCH MỤC TIÊU ====================
function renderGoals() {
    goalList.innerHTML = "";

    if (goals.length === 0) {
        goalList.innerHTML = "<li>Chưa có mục tiêu tiết kiệm nào.</li>";
        return;
    }

    goals.forEach((goal, index) => {
        const li = document.createElement("li");
        li.textContent = `${goal.name} - ${goal.amount.toLocaleString("vi-VN")}đ`;

        // Nút xóa
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "deleteGoalBtn";
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = () => {
            goals.splice(index, 1);
            saveGoals();
            renderGoals();
        };

        li.appendChild(deleteBtn);
        goalList.appendChild(li);
    });
}

// ==================== LƯU MỤC TIÊU ====================
function saveGoals() {
    localStorage.setItem("savingGoals", JSON.stringify(goals));
}

// ==================== XỬ LÝ FORM THÊM MỤC TIÊU ====================
goalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("goalName").value.trim();
    const amount = Number(document.getElementById("goalAmount").value);

    if (!name) {
        alert("Vui lòng nhập tên mục tiêu.");
        return;
    }
    if (amount <= 0 || isNaN(amount)) {
        alert("Vui lòng nhập số tiền hợp lệ lớn hơn 0.");
        return;
    }

    goals.push({ name, amount });
    saveGoals();
    renderGoals();
    goalForm.reset();
});

// ==================== LOGOUT ====================
function logout() {
    localStorage.removeItem('loggedInUser');
    window.location.href = "/QL_chitieu/view/index.html";
}

// ==================== CẬP NHẬT NGÂN SÁCH ====================
setBudgetBtn.addEventListener("click", () => {
    const value = Number(monthlyBudgetInput.value);
    if (value <= 0 || isNaN(value)) {
        alert("Vui lòng nhập ngân sách hợp lệ!");
        return;
    }
    monthlyBudget = value;
    localStorage.setItem("monthlyBudget_" + currentUser, monthlyBudget);
    checkExpenseAlert();
});

// ==================== CẢNH BÁO CHI TIÊU ====================
function checkExpenseAlert() {
    if (!expenseAlert) return;

    // Load mới expenses
    expenses = JSON.parse(localStorage.getItem("expenses_" + currentUser) || "[]");

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let totalExpenseThisMonth = 0;
    const largeExpenses = [];

    expenses.forEach(e => {
        const date = new Date(e.date);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            totalExpenseThisMonth += Number(e.amount);
            if (Number(e.amount) >= 0.2 * monthlyBudget) {
                largeExpenses.push(e);
            }
        }
    });

    const remainingBudget = monthlyBudget - totalExpenseThisMonth;
    const percent = (totalExpenseThisMonth / monthlyBudget) * 100;
    expenseProgress.style.width = percent > 100 ? "100%" : percent + "%";

    // Màu thanh theo mức chi tiêu
    if (percent < 50) {
        // safe: use index accent color
        expenseProgress.style.backgroundColor = "#87cefa";
        alertMessage.textContent = "Chi tiêu trong mức an toàn.";
        alertMessage.style.color = "#87cefa";
    } else if (percent < 80) {
        // warning: warm orange
        expenseProgress.style.backgroundColor = "#f39c12";
        alertMessage.textContent = "⚠️ Bạn đang gần mức ngân sách.";
        alertMessage.style.color = "#f39c12";
    } else {
        // danger: red
        expenseProgress.style.backgroundColor = "#ff4d4d";
        alertMessage.textContent = "⚠️ Bạn sắp vượt ngân sách!";
        alertMessage.style.color = "#ff4d4d";
    }

    totalExpenseDisplay.textContent = `Chi tiêu: ${totalExpenseThisMonth.toLocaleString("vi-VN")}đ`;
    budgetDisplay.textContent = `Ngân sách: ${monthlyBudget.toLocaleString("vi-VN")}đ`;

    // Hiển thị số tiền còn lại
    let remainingDisplay = document.getElementById("remainingBudget");
    if (!remainingDisplay) {
        remainingDisplay = document.createElement("span");
        remainingDisplay.id = "remainingBudget";
        remainingDisplay.style.fontWeight = "bold";
        expenseAlert.appendChild(remainingDisplay);
    }
    remainingDisplay.textContent = `Ngân sách còn lại: ${remainingBudget.toLocaleString("vi-VN")}đ`;

    // Hiển thị các khoản chi lớn
    if (largeExpenses.length > 0) {
        let html = "<p>Các khoản chi lớn:</p><ul>";
        largeExpenses.forEach(e => {
            html += `<li>${e.name} - ${Number(e.amount).toLocaleString("vi-VN")}đ</li>`;
        });
        html += "</ul>";
        largeExpensesList.innerHTML = html;
    } else {
        largeExpensesList.innerHTML = "";
    }

    expenseAlert.style.display = "flex";
}


// ==================== KHỞI TẠO ====================
renderGoals();
checkExpenseAlert();

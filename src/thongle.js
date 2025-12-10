// Lấy user hiện tại
const currentUser = localStorage.getItem("loggedInUser");
const expenses = JSON.parse(localStorage.getItem("expenses_" + currentUser) || "[]");

const today = new Date();
const currentYear = today.getFullYear();

// Hàm parse ngày
function parseDate(str) {
    if (!str) return null;
    if (str.includes("-")) {
        return new Date(str);
    } else if (str.includes("/")) {
        const parts = str.split("/");
        return new Date(parts[2], parts[1]-1, parts[0]);
    }
    return null;
}

// ===== Tạo dữ liệu cho biểu đồ cột =====
const monthlyTotals = Array(12).fill(0);
const monthlyExpensesData = {}; // lưu chi tiết từng tháng

expenses.forEach(e => {
    const date = parseDate(e.date);
    if (!date) return;
    if (date.getFullYear() === currentYear) {
        const monthIndex = date.getMonth(); // 0-11
        monthlyTotals[monthIndex] += Number(e.amount);

        if (!monthlyExpensesData[monthIndex]) monthlyExpensesData[monthIndex] = [];
        monthlyExpensesData[monthIndex].push(e);
    }
});

const barCanvas = document.getElementById("barChart");

// ===== Biểu đồ tròn =====
const pieCanvas = document.getElementById("pieChart");
const noDataMsg = document.getElementById("noDataMessage");

// Hàm vẽ pie chart theo dữ liệu chi tiết
let pieChart = null;
function drawPie(monthIndex) {
    const dataForMonth = monthlyExpensesData[monthIndex] || [];
    const grouped = {};
    dataForMonth.forEach(e => {
        if (!grouped[e.name]) grouped[e.name] = 0;
        grouped[e.name] += Number(e.amount);
    });

    const labels = Object.keys(grouped);
    const data = Object.values(grouped);

    if (labels.length === 0) {
        pieCanvas.style.display = "none";
        noDataMsg.style.display = "block";
    } else {
        pieCanvas.style.display = "block";
        noDataMsg.style.display = "none";

        if (pieChart) pieChart.destroy(); // destroy chart trước khi vẽ lại
        pieChart = new Chart(pieCanvas, {
            type: "pie",
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        "#ff6384", "#36a2eb", "#ffcd56",
                        "#4bc0c0", "#9966ff", "#ff9f40",
                        "#66ff99", "#ff6666"
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    title: {
                        display: true,
                        text: `Chi tiêu tháng ${monthIndex + 1}`
                    }
                }
            }
        });
    }
}

// Vẽ cột chart
const barChart = new Chart(barCanvas, {
    type: "bar",
    data: {
        labels: ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                 "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"],
        datasets: [{
            label: `Chi tiêu năm ${currentYear}`,
            data: monthlyTotals,
            backgroundColor: "#36a2eb",
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: `Chi tiêu theo từng tháng năm ${currentYear}`
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: value => value + "đ"
                }
            }
        },
        onClick: (evt, elements) => {
            if (elements.length > 0) {
                const monthIndex = elements[0].index;
                drawPie(monthIndex); // vẽ pie chart cho tháng được click
            }
        }
    }
});

// Mặc định hiển thị tháng hiện tại
drawPie(today.getMonth());

// ------ Xử lý logout ------
function logout() {
    localStorage.removeItem('loggedInUser');
    // Chuyển về index.html
    window.location.href = "/QL_chitieu/view/index.html";
}

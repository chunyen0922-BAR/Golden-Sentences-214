let currentUser = { name: '', email: '', lineId: '' };
let userVotes = new Set();
const MAX_VOTES = 100;
const ADMIN_EMAILS = ['chunyen0922@gmail.com', 'pho@pho', 'hubeta1982@gmail.com'];

function startVoting() {
    currentUser.name = document.getElementById('userName').value.trim();
    currentUser.email = document.getElementById('userEmail').value.trim();
    currentUser.lineId = document.getElementById('userLine').value.trim();

    if (!currentUser.name || !currentUser.email) { alert("請填寫姓名與 Email"); return; }
    document.getElementById('login-page').classList.remove('active');

    if (ADMIN_EMAILS.includes(currentUser.email)) {
        document.getElementById('admin-container').classList.add('active');
        loadAdminDashboard();
    } else {
        document.getElementById('vote-page').classList.add('active');
        renderFeed();
    }
}

function renderFeed() {
    const container = document.getElementById('feed-container');
    container.innerHTML = ''; 
    sentences.forEach((sentence, index) => {
        const card = document.createElement('div'); card.className = 'card'; card.id = `card-${index}`;
        const number = document.createElement('div'); number.className = 'card-number'; number.innerText = `No. ${index + 1}`;
        const text = document.createElement('p'); text.innerText = sentence;
        const btn = document.createElement('button');
        btn.className = 'vote-btn' + (userVotes.has(index) ? ' voted' : '');
        btn.innerText = userVotes.has(index) ? '★ 已投此句 (點擊取消)' : '投給這句';
        btn.onclick = () => toggleVote(index, btn);
        card.appendChild(number); card.appendChild(text); card.appendChild(btn); container.appendChild(card);
    });
    updateHeader();
}

function toggleVote(index, btnElement) {
    if (userVotes.has(index)) {
        userVotes.delete(index); btnElement.classList.remove('voted'); btnElement.innerText = '投給這句';
    } else {
        if (userVotes.size >= MAX_VOTES) { alert("你已經投滿 100 票囉！"); return; }
        userVotes.add(index); btnElement.classList.add('voted'); btnElement.innerText = '★ 已投此句 (點擊取消)';
    }
    updateHeader();
}

function updateHeader() { document.getElementById('votes-left-text').innerText = `剩餘票數: ${MAX_VOTES - userVotes.size}`; }

function showSummary() {
    document.getElementById('vote-page').classList.remove('active');
    document.getElementById('summary-container').classList.add('active');
    window.scrollTo(0, 0);
    const grid = document.getElementById('grid-container'); grid.innerHTML = '';
    for (let i = 0; i < sentences.length; i++) {
        let cell = document.createElement('div');
        cell.className = 'grid-cell' + (userVotes.has(i) ? ' selected' : ''); cell.innerText = i + 1;
        cell.onclick = () => {
            backToFeed();
            setTimeout(() => {
                const tCard = document.getElementById(`card-${i}`);
                if (tCard) window.scrollTo({ top: tCard.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
            }, 100);
        };
        grid.appendChild(cell);
    }
}

function backToFeed() { document.getElementById('summary-container').classList.remove('active'); document.getElementById('vote-page').classList.add('active'); }

async function submitFinalVotes() {
    if (userVotes.size === 0) { if(!confirm("你目前沒有投任何票，確定要送出嗎？")) return; }
    try {
        const response = await fetch('/api/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...currentUser, votes: Array.from(userVotes) })
        });
        if (response.ok) {
            // 切換到感謝頁面
            document.getElementById('summary-container').classList.remove('active');
            document.getElementById('thankyou-page').classList.add('active');
            window.scrollTo(0, 0);
        }
    } catch (error) { alert("傳送失敗，請檢查網路連線。"); }
}

// ----- 管理員專用功能 -----
window.currentStatsArray = []; // 新增：暫存統計資料供 CSV 使用

async function loadAdminDashboard() {
    try {
        const res = await fetch(`/api/admin/stats?email=${currentUser.email}`);
        const data = await res.json();
        document.getElementById('admin-info').innerText = `目前總投票人數：${data.totalUsers} 人`;
        
        const tbody = document.getElementById('admin-users-tbody'); tbody.innerHTML = '';
        if (data.users && data.users.length > 0) {
            data.users.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            data.users.forEach(user => {
                let tr = document.createElement('tr');
                let dateStr = new Date(user.timestamp).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                tr.innerHTML = `
                    <td>${user.name}</td><td>${user.email}</td><td>${user.lineId || '<span style="color:#aaa;">未填寫</span>'}</td><td>${dateStr}</td>
                    <td><button onclick="deleteUser('${user.email}')" class="delete-btn">刪除</button></td>
                `;
                tbody.appendChild(tr);
            });
        } else { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">目前尚無人完成投票</td></tr>'; }

        // 整理統計數據供排序使用
        window.currentStatsArray = [];
        for (let i = 0; i < sentences.length; i++) {
            window.currentStatsArray.push({ index: i, votes: data.stats[i] || 0, text: sentences[i] });
        }
        
        // 依照票數由高到低排序，並取出前 90 名 (且票數大於 0) 的編號
        let sortedArray = [...window.currentStatsArray].sort((a, b) => b.votes - a.votes);
        let top90Indices = new Set(sortedArray.slice(0, 90).filter(item => item.votes > 0).map(item => item.index));

        const grid = document.getElementById('admin-grid'); grid.innerHTML = '';
        for (let i = 0; i < sentences.length; i++) {
            let cell = document.createElement('div'); let v = data.stats[i] || 0;
            cell.className = 'grid-cell admin-cell'; 
            if (v > 0) cell.classList.add('selected');
            if (top90Indices.has(i)) cell.classList.add('top-rank'); // 命中前 90 名，套用金色樣式

            cell.innerHTML = `${i + 1}<br><span>${v} 票</span>`; cell.title = sentences[i]; grid.appendChild(cell);
        }
    } catch (e) { console.error(e); }
}

// 新增：下載 CSV 的功能
function downloadCSV() {
    if (!window.currentStatsArray || window.currentStatsArray.length === 0) return alert("資料尚未載入");

    // 加入 BOM 碼，確保 Excel 打開中文不會變亂碼
    let csvContent = "\uFEFF排名,金句編號,得票數,金句內容\n";

    // 取前 90 名
    let sortedArray = [...window.currentStatsArray].sort((a, b) => b.votes - a.votes).slice(0, 90);

    sortedArray.forEach((row, index) => {
        if (row.votes > 0) { // 確保 0 票的不佔據排名
            let escapedText = row.text.replace(/"/g, '""'); // CSV 防跑版處理
            csvContent += `${index + 1},No.${row.index + 1},${row.votes},"${escapedText}"\n`;
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Pho_Project_Top90_金句統計.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteUser(targetEmail) {
    if(!confirm(`確定要刪除 ${targetEmail} 的投票紀錄嗎？`)) return;
    try {
        const res = await fetch(`/api/admin/user/${targetEmail}?adminEmail=${currentUser.email}`, { method: 'DELETE' });
        if(res.ok) loadAdminDashboard(); // 重新整理畫面
    } catch (e) { alert("刪除失敗"); }
}

async function clearAllData() {
    if(!confirm("⚠️ 警告：這將會清除【所有人的投票紀錄】，資料無法復原！確定要歸零嗎？")) return;
    try {
        const res = await fetch(`/api/admin/reset?adminEmail=${currentUser.email}`, { method: 'DELETE' });
        if(res.ok) loadAdminDashboard();
    } catch (e) { alert("歸零失敗"); }
}

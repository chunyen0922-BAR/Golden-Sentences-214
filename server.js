const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './votes_db.json';
const ADMINS = ['chunyen0922@gmail.com', 'hubeta1982@gmail.com'];

// 初始化資料庫
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// 接收投票
app.post('/api/submit', (req, res) => {
    const { email, name, lineId, votes } = req.body;
    if (!email || !name) return res.status(400).send('缺少必填欄位');

    let db = JSON.parse(fs.readFileSync(DB_FILE));
    db = db.filter(user => user.email !== email); // 覆蓋舊紀錄
    db.push({ email, name, lineId, votes, timestamp: new Date() });
    
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    res.json({ success: true });
});

// 管理員取得統計資料
app.get('/api/admin/stats', (req, res) => {
    const email = req.query.email;
    if (!ADMINS.includes(email)) return res.status(403).json({ error: '權限不足' });

    const db = JSON.parse(fs.readFileSync(DB_FILE));
    let sentenceStats = {};
    let userList = db.map(u => ({ name: u.name, email: u.email, lineId: u.lineId, timestamp: u.timestamp }));

    db.forEach(user => {
        user.votes.forEach(voteIndex => {
            sentenceStats[voteIndex] = (sentenceStats[voteIndex] || 0) + 1;
        });
    });
    res.json({ totalUsers: db.length, stats: sentenceStats, users: userList });
});

// 管理員：刪除單筆資料
app.delete('/api/admin/user/:targetEmail', (req, res) => {
    const adminEmail = req.query.adminEmail;
    if (!ADMINS.includes(adminEmail)) return res.status(403).json({ error: '權限不足' });

    let db = JSON.parse(fs.readFileSync(DB_FILE));
    db = db.filter(user => user.email !== req.params.targetEmail);
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    res.json({ success: true });
});

// 管理員：全部歸零
app.delete('/api/admin/reset', (req, res) => {
    const adminEmail = req.query.adminEmail;
    if (!ADMINS.includes(adminEmail)) return res.status(403).json({ error: '權限不足' });

    fs.writeFileSync(DB_FILE, JSON.stringify([])); // 清空陣列
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Beta Project 伺服器已啟動！請在瀏覽器輸入 http://localhost:${PORT}`);
});

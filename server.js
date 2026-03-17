const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 初始化 Firebase Admin SDK (透過環境變數安全讀取金鑰)
// 如果是在本地端測試，會去讀取 .env 檔；如果在 Render，會讀取 Render 後台設定
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // 處理私鑰字串中換行符號的問題
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const ADMINS = ['chunyen0922@gmail.com', 'hubeta1982@gmail.com'];

// 2. 接收投票 (寫入 Firestore)
app.post('/api/submit', async (req, res) => {
    const { email, name, lineId, votes } = req.body;
    if (!email || !name) return res.status(400).send('缺少必填欄位');

    try {
        // 使用 email 當作文件的 ID，這樣重複投票就會自動覆蓋舊紀錄
        await db.collection('votes').doc(email).set({
            name,
            email,
            lineId: lineId || '',
            votes,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (error) {
        console.error("寫入資料庫失敗:", error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// 3. 管理員取得統計資料
app.get('/api/admin/stats', async (req, res) => {
    const email = req.query.email;
    if (!ADMINS.includes(email)) return res.status(403).json({ error: '權限不足' });

    try {
        const snapshot = await db.collection('votes').get();
        let sentenceStats = {};
        let userList = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // 整理使用者名單，並將 Firestore 時間戳轉為標準時間
            userList.push({
                name: data.name,
                email: data.email,
                lineId: data.lineId,
                timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
            });

            // 計算各句得票數
            if (data.votes && Array.isArray(data.votes)) {
                data.votes.forEach(voteIndex => {
                    sentenceStats[voteIndex] = (sentenceStats[voteIndex] || 0) + 1;
                });
            }
        });

        res.json({ totalUsers: userList.length, stats: sentenceStats, users: userList });
    } catch (error) {
        console.error("讀取資料庫失敗:", error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

// 4. 管理員：刪除單筆資料
app.delete('/api/admin/user/:targetEmail', async (req, res) => {
    const adminEmail = req.query.adminEmail;
    if (!ADMINS.includes(adminEmail)) return res.status(403).json({ error: '權限不足' });

    try {
        await db.collection('votes').doc(req.params.targetEmail).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '刪除失敗' });
    }
});

// 5. 管理員：全部歸零 (批次刪除)
app.delete('/api/admin/reset', async (req, res) => {
    const adminEmail = req.query.adminEmail;
    if (!ADMINS.includes(adminEmail)) return res.status(403).json({ error: '權限不足' });

    try {
        const snapshot = await db.collection('votes').get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '歸零失敗' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Beta Project 伺服器已啟動！請在瀏覽器輸入 http://localhost:${PORT}`);
});

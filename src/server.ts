// server.ts dosyasının son ve tam hali

import express from 'express';
import session from 'express-session';
import path from 'path';
import bcrypt from 'bcrypt';
import { db } from './services/db.service';
import { encrypt, decrypt } from './services/crypto.service';
import * as paytrService from './services/paytr.service';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // @ts-ignore
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/', (req, res) => {
    // @ts-ignore
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// ... (login ve register GET/POST blokları burada)

app.get('/dashboard', isAuthenticated, async (req, res) => {
    // @ts-ignore
    const userId = req.session.user.id;
    // @ts-ignore
    const userEmail = req.session.user.email;
    const yourAppUrl = `https://${req.hostname}`; 
    const webhookUrl = `${yourAppUrl}/webhook/ghl?userId=${userId}`;

    const settings = await db.settings.findUnique({ where: { userId } });
    const settingsComplete = settings ? 'Ayarlarınız başarıyla kaydedilmiş.' : 'Lütfen entegrasyon için ayarlarınızı tamamlayın.';

    const html = `
        <style>body { font-family: sans-serif; background: #222; color: #fff; padding: 2rem; } code { background: #444; padding: 2px 5px; border-radius: 3px; }</style>
        <h1>Yönetim Paneli</h1>
        <p>Hoş geldiniz, ${userEmail}!</p>
        <p><a href="/settings">Ayarlar</a></p>
        <hr>
        <h3>Entegrasyon Bilgileri</h3>
        <p>${settingsComplete}</p>
        <h4>GoHighLevel Webhook URL'iniz:</h4>
        <p>Bu URL'i kopyalayıp GHL form ayarlarınıza yapıştırın:</p>
        <pre><code>${webhookUrl}</code></pre>
    `;
    res.send(html);
});

// ... (settings GET/POST blokları burada)

app.post('/webhook/ghl', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) throw new Error('Webhook URL\'de kullanıcı kimliği (userId) eksik.');

    const settings = await db.settings.findUnique({ where: { userId } });
    if (!settings) throw new Error('Bu kullanıcı için ayarlar bulunamadı.');

    const paytrKeys = {
      merchantId: decrypt(settings.paytrMerchantId),
      merchantKey: decrypt(settings.paytrMerchantKey),
      merchantSalt: decrypt(settings.paytrMerchantSalt),
    };

    const { email, full_name, contact_id, customData } = req.body;
    if(!contact_id) throw new Error('Form verisinde contact_id bulunamadı.');
    const amount = parseFloat(customData?.tutar || '1') * 100;

    const paymentUrl = await paytrService.createPaymentUrl(
      {
        email,
        amount,
        orderId: `ghl-${contact_id}-${userId}-${Date.now()}`, // userId'yi de ekledik
        fullName: full_name || 'Isim Bilgisi Yok',
        userIp: req.ip || '127.0.0.1',
      },
      paytrKeys
    );
    res.redirect(302, paymentUrl);
  } catch (error: any) {
    console.error('Webhook işlenirken hata:', error.message);
    res.status(500).send(`Bir hata oluştu: ${error.message}`);
  }
});

app.post('/callback/paytr', async (req, res) => {
    try {
        const { merchant_oid, status } = req.body;

        if (status === 'success') {
            const parts = merchant_oid.split('-');
            const contactId = parts[1];
            const userId = parts[2];

            const settings = await db.settings.findUnique({ where: { userId } });
            if(!settings) throw new Error(`Callback için ayarlar bulunamadı: ${userId}`);

            const ghlApiKey = decrypt(settings.ghlApiKey);

            const tagResponse = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}/tags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ghlApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tags: ['Odeme-Basarili-PayTR'] })
            });

            if(!tagResponse.ok){
                console.error("GHL Etiket Ekleme Hatası:", await tagResponse.text());
            } else {
                console.log(`Kişi ${contactId} için 'Odeme-Basarili-PayTR' etiketi eklendi.`);
            }
        }
        res.send('OK');
    } catch(error: any) {
        console.error("Callback işlenirken hata:", error.message);
        res.send('OK');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

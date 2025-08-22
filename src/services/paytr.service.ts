// src/services/paytr.service.ts dosyasının içeriği

import axios from 'axios';
import crypto from 'crypto';

// Bu arayüz, PayTR anahtarlarını bir arada tutmamızı sağlar
interface PaytrKeys {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

// Bu arayüz, ödeme için gereken bilgileri tanımlar
interface PaymentData {
  email: string;
  amount: number; // Örnek: 10.50 TL için 1050
  orderId: string;
  fullName: string;
  userIp: string;
}

export const createPaymentUrl = async (paymentData: PaymentData, keys: PaytrKeys) => {
  const { merchantId, merchantKey, merchantSalt } = keys;
  const { email, amount, orderId, fullName, userIp } = paymentData;

  // PayTR'ın istediği formatta ürün sepeti oluşturma
  const basket = Buffer.from(JSON.stringify([["Sipariş", amount / 100, 1]])).toString('base64');

  const successUrl = 'https://siteniz.com/odeme-basarili'; // Ödeme sonrası yönlendirilecek başarı sayfası
  const failUrl = 'https://siteniz.com/odeme-basarisiz';   // Ödeme sonrası yönlendirilecek hata sayfası

  const hashStr = `${merchantId}${userIp}${orderId}${email}${amount}${basket}1TL${successUrl}${failUrl}`;
  const paytrToken = crypto.createHmac('sha256', merchantKey).update(hashStr + merchantSalt).digest('base64');

  const params = new URLSearchParams();
  params.append('merchant_id', merchantId);
  params.append('user_ip', userIp);
  params.append('merchant_oid', orderId);
  params.append('email', email);
  params.append('payment_amount', amount.toString());
  params.append('paytr_token', paytrToken);
  params.append('user_basket', basket);
  params.append('debug_on', '1');
  params.append('no_installment', '1');
  params.append('max_installment', '0');
  params.append('user_name', fullName);
  params.append('user_address', 'N/A');
  params.append('user_phone', 'N/A');
  params.append('merchant_ok_url', successUrl);
  params.append('merchant_fail_url', failUrl);
  params.append('currency', 'TL');
  params.append('test_mode', '1'); // Test modunu etkinleştir

  const response = await axios.post('https://www.paytr.com/odeme/api/get-token', params);

  if (response.data.status !== 'success') {
    throw new Error(`PayTR Token Error: ${response.data.reason}`);
  }

  return `https://www.paytr.com/odeme/guvenli/${response.data.token}`;
};
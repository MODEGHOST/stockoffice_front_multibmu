export const BANK_LOGOS: Record<string, string> = {
  "ธนาคารกสิกรไทย (KBANK)": "/img/kbank.jpg",
  "ธนาคารไทยพาณิชย์ (SCB)": "/img/scb.jpg",
  "ธนาคารกรุงเทพ (BBL)": "/img/bbl.jpg",
  "ธนาคารกรุงไทย (KTB)": "/img/ktb.jpg",
  "ธนาคารกรุงศรีอยุธยา (BAY)": "/img/bay.jpg",
  "ธนาคารทหารไทยธนชาต (TTB)": "/img/ttb.jpg",
  "ธนาคารออมสิน (GSB)": "/img/gsb.jpg",
  "ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)": "/img/baac.jpg",
};

export const EWALLET_LOGOS: Record<string, string> = {
  "TrueMoney Wallet": "/img/truemoney.jpg",
  "พร้อมเพย์ (PromptPay)": "/img/promptpay.jpg",
  "PromptPay": "/img/promptpay.jpg", // in case of fallback
  "PayPal": "/img/paypal.jpg",
  "Alipay": "/img/alipay.jpg",
  "WeChat Pay": "/img/wechat.jpg",
  "Rabbit LINE Pay": "/img/linepay.jpg",
  "ShopeePay": "/img/shopeepay.jpg",
};

export const getProviderLogo = (type: string, providerName: string): string | null => {
  if (!providerName) return null;
  if (type === "BANK") {
    return BANK_LOGOS[providerName] || null;
  }
  if (type === "EWALLET") {
    return EWALLET_LOGOS[providerName] || null;
  }
  return null;
};

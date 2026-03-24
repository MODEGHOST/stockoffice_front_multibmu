import { useEffect } from 'react';
import { notification, Button } from 'antd';
// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: any) {
      console.error('SW Registration Error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      const key = `open${Date.now()}`;
      notification.info({
        message: 'มีอัปเดตเวอร์ชันใหม่!',
        description: 'ระบบมีการอัปเดตฟีเจอร์ใหม่ กรุณากดปุ่มด้านล่างเพื่อโหลดซ้ำ',
        duration: 0,
        key,
        btn: (
          <Button 
            type="primary" 
            size="small" 
            onClick={() => {
              updateServiceWorker(true);
              notification.destroy(key);
            }}
          >
            อัปเดตตอนนี้เลย
          </Button>
        ),
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}

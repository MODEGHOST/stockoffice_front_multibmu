import { useState, useEffect } from 'react';
import { Button, notification } from 'antd';
import { AppstoreAddOutlined } from '@ant-design/icons';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
    
    if (outcome === 'accepted') {
      notification.success({
        message: 'ติดตั้งแอปสำเร็จ!',
        description: 'StockOffice พร้อมใช้งานผ่านหน้าจอหลักของคุณแล้ว',
      });
      setIsInstalled(true);
    }
  };

  // Only show the button if it's installable and not already installed
  if (!isInstallable || isInstalled) return null;

  return (
    <Button 
      type="primary" 
      icon={<AppstoreAddOutlined />} 
      onClick={handleInstallClick}
      className="bg-blue-600 hover:bg-blue-500 shadow-md font-medium"
      style={{ borderRadius: '8px' }}
    >
      ติดตั้งแอป
    </Button>
  );
}

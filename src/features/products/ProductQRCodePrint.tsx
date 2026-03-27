import React from "react";
import { QRCodeSVG } from "qrcode.react";

type PrintProps = {
  product: { id: number; company_id: number; code: string; name: string };
};

export const ProductQRCodePrint = React.forwardRef<HTMLDivElement, PrintProps>(
  ({ product }, ref) => {
    // สร้าง URL สำหรับให้มือถือสแกน เช่น http://localhost:5173/p/Mjox     (2:1 => Mjox)
    const hashData = btoa(`${product.company_id}:${product.id}`);
    const scanUrl = `${window.location.origin}/p/${hashData}`;

    return (
      <div ref={ref} className="p-8 pb-32 bg-white">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}} />
        <div className="border-4 border-black w-full max-w-lg mx-auto flex flex-col bg-white">
          {/* Header Row: 50/50 split */}
          <div className="flex w-full border-b-4 border-black border-collapse">
            <div className="w-1/2 p-4 text-center border-r-4 border-black flex items-center justify-center min-h-[80px]">
              <span className="text-xl font-bold">{product.code}</span>
            </div>
            <div className="w-1/2 p-4 text-center flex items-center justify-center min-h-[80px]">
              <span className="text-xl font-bold line-clamp-2">{product.name}</span>
            </div>
          </div>

          {/* QR Code Row */}
          <div className="flex flex-col items-center justify-center p-10 min-h-[300px]">
            <QRCodeSVG value={scanUrl} size={250} level="H" />
            <span className="mt-6 text-xl font-bold uppercase tracking-widest text-black">
              QRCode
            </span>
          </div>
        </div>
      </div>
    );
  }
);

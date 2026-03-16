import { Modal } from "antd";

export function okModal(title: string, content?: string) {
  Modal.success({ title, content, centered: true });
}

export function errorModal(title: string, content?: string) {
  Modal.error({ title, content: content || "เกิดข้อผิดพลาด", centered: true });
}

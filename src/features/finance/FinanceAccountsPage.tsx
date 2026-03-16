import { useEffect, useState, useMemo } from "react";
import { Button, Card, Row, Col, Typography, message, Dropdown, Space, Divider } from "antd";
import type { MenuProps } from "antd";
import { PlusOutlined, MoreOutlined, BankOutlined, WalletOutlined, DollarOutlined, UserOutlined, HistoryOutlined } from "@ant-design/icons";
import { financeApi } from "./financeApi";
import type { FinanceAccount } from "./financeApi";
import FinanceAccountFormModal from "./components/FinanceAccountFormModal";
import FinanceTransactionModal from "./components/FinanceTransactionModal";
import { getProviderLogo } from "./financeConstants";

const { Title, Text } = Typography;

export default function FinanceAccountsPage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<FinanceAccount | null>(null);
  
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<FinanceAccount | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await financeApi.list();
      setAccounts(data);
    } catch (err: any) {
      message.error("Failed to load accounts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSave = async (values: any) => {
    try {
      if (editData) {
        await financeApi.update(editData.id, values);
        message.success("แก้ไขบัญชีสำเร็จ");
      } else {
        await financeApi.create(values);
        message.success("สร้างบัญชีใหม่สำเร็จ");
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      message.error("บันทึกไม่สำเร็จ: " + msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("คุณต้องการลบบัญชีนี้ใช่หรือไม่?")) return;
    try {
      await financeApi.delete(id);
      message.success("ลบบัญชีสำเร็จ");
      fetchAccounts();
    } catch (err: any) {
      message.error("ลบไม่สำเร็จ: " + err.message);
    }
  };

  const openCreateModal = () => {
    setEditData(null);
    setModalOpen(true);
  };

  const openEditModal = (acc: FinanceAccount) => {
    setEditData(acc);
    setModalOpen(true);
  };

  const openHistoryModal = (acc: FinanceAccount) => {
    setHistoryAccount(acc);
    setHistoryModalOpen(true);
  };

  // Group Accounts
  const cashAccounts = useMemo(() => accounts.filter(a => a.type === "CASH"), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter(a => a.type === "BANK"), [accounts]);
  const ewalletAccounts = useMemo(() => accounts.filter(a => a.type === "EWALLET"), [accounts]);
  const advanceAccounts = useMemo(() => accounts.filter(a => a.type === "ADVANCE"), [accounts]);

  // Totals
  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.balance), 0), [accounts]);
  const cashTotal = useMemo(() => cashAccounts.reduce((sum, a) => sum + Number(a.balance), 0), [cashAccounts]);
  const bankTotal = useMemo(() => bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0), [bankAccounts]);
  const ewalletTotal = useMemo(() => ewalletAccounts.reduce((sum, a) => sum + Number(a.balance), 0), [ewalletAccounts]);
  const advanceTotal = useMemo(() => advanceAccounts.reduce((sum, a) => sum + Number(a.balance), 0), [advanceAccounts]);

  const renderDropdown = (acc: FinanceAccount) => {
    const items: MenuProps['items'] = [
      { key: "0", label: "ดูประวัติรายการ", icon: <HistoryOutlined />, onClick: () => openHistoryModal(acc) },
      { type: "divider" },
      { key: "1", label: "แก้ไขข้อมูล", onClick: () => openEditModal(acc) },
      { key: "2", label: "ลบบัญชี", danger: true, onClick: () => handleDelete(acc.id) },
    ];
    return (
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button type="text" icon={<MoreOutlined />} />
      </Dropdown>
    );
  };

  const renderCards = (accList: FinanceAccount[], icon: React.ReactNode) => {
    return (
      <Row gutter={[16, 16]}>
        {accList.map(acc => {
          const bal = Number(acc.balance);
          const balColor = bal < 0 ? "text-red-500" : "text-green-600";
          const logoUrl = getProviderLogo(acc.type, acc.provider_name || "");

          return (
            <Col xs={24} sm={12} md={8} lg={6} key={acc.id}>
              <Card 
                size="small" 
                hoverable
                onClick={() => openHistoryModal(acc)}
                className="shadow-sm border-gray-200 h-full flex flex-col cursor-pointer transition-shadow hover:shadow-md"
                bodyStyle={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}
              >
                <div className="flex justify-between items-start mb-2">
                  <Space align="start" className="flex-1 overflow-hidden">
                    <div className="mt-1 text-blue-500 text-lg flex items-center justify-center w-8 h-8 shrink-0">
                      {logoUrl ? (
                        <img src={logoUrl} alt={acc.provider_name || ""} className="max-w-full max-h-full object-contain rounded-sm" />
                      ) : (
                        icon
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-gray-800 text-sm truncate" title={acc.name}>{acc.name}</div>
                      
                      {acc.type === 'BANK' && (
                        <div className="text-xs text-gray-500 truncate" title={`${acc.provider_name} - ${acc.account_no}`}>
                          {acc.provider_name} • {acc.account_no}
                        </div>
                      )}
                      {acc.type === 'EWALLET' && (
                        <div className="text-xs text-gray-500 truncate" title={`${acc.provider_name} - ${acc.account_no}`}>
                          {acc.provider_name} • {acc.account_no}
                        </div>
                      )}
                      {acc.type === 'ADVANCE' && (
                        <div className="text-xs text-gray-500 truncate" title={`${acc.person_name} - ${acc.contact_number}`}>
                          {acc.person_name} • {acc.contact_number}
                        </div>
                      )}
                    </div>
                  </Space>
                  <div onClick={(e) => e.stopPropagation()}>
                    {renderDropdown(acc)}
                  </div>
                </div>
                
                <div className="mt-auto pt-4 text-right">
                   <div className={`text-base font-semibold ${balColor}`}>
                      {bal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                   </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <Space size="middle" align="center">
          <Title level={4} style={{ margin: 0 }}>เงินสด/ธนาคาร/e-Wallet ทั้งหมด {accounts.length} บัญชี</Title>
          <Button shape="round" icon={<PlusOutlined />} onClick={openCreateModal}>
            เพิ่มช่องทางการเงิน
          </Button>
        </Space>
        
        <div className="text-right">
          <Text className="text-gray-500 mr-2">รวมทั้งหมด</Text>
          <Text className="text-xl font-bold text-blue-600">
            {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
          </Text>
        </div>
      </div>

      <Divider />

      {/* Cash Section */}
      {cashAccounts.length > 0 && (
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-4">
            <Space>
              <DollarOutlined className="text-xl text-blue-600" />
              <Title level={5} style={{ margin: 0 }}>เงินสด {cashAccounts.length} บัญชี</Title>
            </Space>
            <div className="text-gray-600 font-medium">รวม {cashTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</div>
          </div>
          {renderCards(cashAccounts, <DollarOutlined />)}
        </div>
      )}

      {/* Bank Section */}
      {bankAccounts.length > 0 && (
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-4">
            <Space>
              <BankOutlined className="text-xl text-blue-600" />
              <Title level={5} style={{ margin: 0 }}>ธนาคาร {bankAccounts.length} บัญชี</Title>
            </Space>
            <div className="text-gray-600 font-medium">รวม {bankTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</div>
          </div>
          {renderCards(bankAccounts, <BankOutlined />)}
        </div>
      )}

      {/* E-Wallet Section */}
      {ewalletAccounts.length > 0 && (
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-4">
            <Space>
              <WalletOutlined className="text-xl text-blue-600" />
              <Title level={5} style={{ margin: 0 }}>e-Wallet / กระเป๋าเงินดิจิตอล {ewalletAccounts.length} บัญชี</Title>
            </Space>
            <div className="text-gray-600 font-medium">รวม {ewalletTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</div>
          </div>
          {renderCards(ewalletAccounts, <WalletOutlined />)}
        </div>
      )}

      {/* Advance Payment Section */}
      {advanceAccounts.length > 0 && (
        <div className="mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-4">
            <Space>
              <UserOutlined className="text-xl text-blue-600" />
              <Title level={5} style={{ margin: 0 }}>สำรองจ่าย / เงินสดย่อย {advanceAccounts.length} บัญชี</Title>
            </Space>
            <div className="text-gray-600 font-medium">รวม {advanceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</div>
          </div>
          {renderCards(advanceAccounts, <UserOutlined />)}
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && !loading && (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <WalletOutlined className="text-4xl text-gray-300 mb-4" />
          <Title level={5} className="text-gray-400">ยังไม่มีข้อมูลช่องทางการเงิน</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} className="mt-4">
            เพิ่มบัญชีแรก
          </Button>
        </div>
      )}

      <FinanceAccountFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editData}
        onSave={handleSave}
      />

      <FinanceTransactionModal 
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        account={historyAccount}
      />
    </div>
  );
}

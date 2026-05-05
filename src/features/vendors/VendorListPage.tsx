// VendorListPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Collapse,
} from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import {
  createVendor,
  getVendor,
  getNextVendorCode,
  listVendors,
  setVendorActive,
  updateVendor,
  type VendorRow,
  type VendorUpsert,
  type VendorContact,
  type VendorBankAccount,
  type VendorContactChannel,
  type VendorPaymentTerm,
  type VendorPerson,
  type VendorDetail,
} from "./vendorApi";
import { hasPermission } from "../auth/authStore";

const { Title, Text } = Typography;

const THAI_BANKS = [
  "ธนาคารกรุงเทพ",
  "ธนาคารกสิกรไทย",
  "ธนาคารไทยพาณิชย์",
  "ธนาคารกรุงไทย",
  "ธนาคารกรุงศรีอยุธยา",
  "ธนาคารทหารไทยธนชาต (ttb)",
  "ธนาคารออมสิน",
  "ธนาคารอาคารสงเคราะห์",
  "ธนาคารเกียรตินาคินภัทร",
  "ธนาคารซีไอเอ็มบี ไทย",
  "ธนาคารยูโอบี",
  "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  "ธนาคารไอซีบีซี (ไทย)",
];

const PREFIX_OPTIONS = ["นาย", "นาง", "นางสาว", "คุณ"].map((x) => ({ value: x, label: x }));

const MONTH_DAYS_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  return { value: d, label: `ทุกวันที่ ${d}` };
});

type PaymentType = "by_days" | "by_month_day" | "by_date";

// ✅ legal_form (ให้สอดคล้องกับ vendorApi.ts / backend routes)
type LegalFormCode =
  | "company_limited"
  | "public_company"
  | "limited_partnership"
  | "foundation"
  | "association"
  | "joint_venture"
  | "other"
  | "personal_individual"
  | "personal_ordinary_partnership"
  | "personal_shop"
  | "personal_group";

type PartyType = "juristic" | "personal";

type FormValues = {
  code: string;
  is_active?: boolean;
  type?: "VENDOR" | "CUSTOMER" | "BOTH";

  business?: {
    tax_no_13?: string | null;
    tax_country?: "TH" | "OTHER";
    branch_type?: "hq" | "branch" | "na";
    party_type?: PartyType;

    legal_form_code?: LegalFormCode | null;

    // ✅ juristic => ช่องเดียว (jur_core) + ซ่อน prefix/suffix
    jur_prefix?: string | null;
    jur_core?: string | null;
    jur_suffix?: string | null;

    // personal
    personal_prefix?: string | null;
    personal_first?: string | null;
    personal_last?: string | null;

    // shop/group
    shop_name?: string | null;
    group_name?: string | null;
  };

  registered_address?: {
    contact?: string | null;
    address?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
  };

  shipping_address?: {
    contact?: string | null;
    address?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
  };

  goods_shipping_address?: {
    contact?: string | null;
    phone?: string | null;
    address?: string | null;
    subdistrict?: string | null;
    district?: string | null;
    province?: string | null;
    postcode?: string | null;
  };

  contact_channels?: {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    fax?: string | null;
  };

  people?: {
    prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
    department?: string | null;
    is_primary?: boolean;
  }[];

  extra_contacts?: { label?: string; channel: VendorContactChannel; value: string; is_primary?: boolean }[];

  bank_accounts?: {
    bank_code?: string | null;
    bank_name: string;
    account_name: string;
    account_no: string;
    branch_code?: string | null;
    is_default?: boolean;
  }[];

  payment_term?: {
    type?: PaymentType;
    due_days?: number;
    month_day?: number;
    due_date?: any; // dayjs
  };
};

function compactStr(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function isValidThaiNationalId(value?: string | null) {
  const taxId = compactStr(value);
  if (!taxId) return true;
  if (!/^\d{13}$/.test(taxId)) return false;

  const sum = taxId
    .slice(0, 12)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === Number(taxId[12]);
}

function numericOnlyProps(maxLength?: number) {
  return {
    maxLength,
    inputMode: "numeric" as const,
    onKeyDown: (e: any) => {
      const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (allowedKeys.includes(e.key) || e.metaKey || e.ctrlKey) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    },
    onPaste: (e: any) => {
      const text = e.clipboardData.getData("text");
      if (!/^[0-9]+$/.test(text)) e.preventDefault();
    },
  };
}

function splitFullName(full: string): { first: string; last: string | null } {
  const t = compactStr(full);
  if (!t) return { first: "", last: null };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: t, last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts.slice(-1).join(" ") || null };
}

function mapOfficeType(branch_type?: "hq" | "branch" | "na") {
  if (branch_type === "hq") return "hq";
  if (branch_type === "branch") return "branch";
  return "unknown";
}

function mapLegalEntityType(party_type?: PartyType) {
  return party_type === "personal" ? "individual" : "corporate";
}

// ✅ map back จาก DB legal_form -> FormValues.business.legal_form_code
function mapBackLegalForm(legal_form?: string | null): LegalFormCode | null {
  const v = compactStr(legal_form);
  if (!v) return null;
  const known: Record<string, LegalFormCode> = {
    company_limited: "company_limited",
    public_company: "public_company",
    limited_partnership: "limited_partnership",
    foundation: "foundation",
    association: "association",
    joint_venture: "joint_venture",
    other: "other",
    personal_individual: "personal_individual",
    personal_ordinary_partnership: "personal_ordinary_partnership",
    personal_shop: "personal_shop",
    personal_group: "personal_group",
  };
  return known[v] ?? null;
}

function isJuristicForm(code?: LegalFormCode | null) {
  return (
    code === "company_limited" ||
    code === "public_company" ||
    code === "limited_partnership" ||
    code === "foundation" ||
    code === "association" ||
    code === "joint_venture" ||
    code === "other"
  );
}

function legalFormLabel(code?: LegalFormCode | null) {
  switch (code) {
    case "company_limited":
      return "บริษัทจำกัด";
    case "public_company":
      return "บริษัทมหาชนจำกัด";
    case "limited_partnership":
      return "ห้างหุ้นส่วนจำกัด (หจก.)";
    case "foundation":
      return "มูลนิธิ";
    case "association":
      return "สมาคม";
    case "joint_venture":
      return "กิจการร่วมค้า";
    case "other":
      return "อื่นๆ (นิติบุคคล)";
    case "personal_individual":
      return "บุคคลธรรมดา";
    case "personal_ordinary_partnership":
      return "ห้างหุ้นส่วนสามัญ";
    case "personal_shop":
      return "ร้านค้า";
    case "personal_group":
      return "คณะบุคคล";
    default:
      return "ไม่ระบุ";
  }
}

// --- สร้างชื่อกิจการ (juristic) แบบ prefix/core/suffix ---
function buildJuristicName(prefix?: string | null, core?: string | null, suffix?: string | null) {
  const p = compactStr(prefix);
  const c = compactStr(core);
  const s = compactStr(suffix);
  return [p, c, s].filter(Boolean).join(" ").trim();
}

// --- สร้างชื่อบุคคล (personal) ---
function buildPersonalName(prefix?: string | null, first?: string | null, last?: string | null) {
  const p = compactStr(prefix);
  const f = compactStr(first);
  const l = compactStr(last);
  return [p, f, l].filter(Boolean).join(" ").trim();
}

function buildShopName(shop?: string | null) {
  const c = compactStr(shop);
  if (!c) return "";
  return c.startsWith("ร้าน") ? c : `ร้าน${c}`;
}
function buildGroupName(g?: string | null) {
  const c = compactStr(g);
  if (!c) return "";
  return c.startsWith("คณะบุคคล") ? c : `คณะบุคคล ${c}`;
}

// --- derive default juristic prefix/suffix based on legal_form ---
function deriveJuristicPrefixSuffix(code?: LegalFormCode | null) {
  if (code === "company_limited") return { jur_prefix: "บริษัท", jur_suffix: "จำกัด" };
  if (code === "public_company") return { jur_prefix: "บริษัท", jur_suffix: "มหาชนจำกัด" };
  if (code === "limited_partnership") return { jur_prefix: "ห้างหุ้นส่วนจำกัด", jur_suffix: "" };
  if (code === "foundation") return { jur_prefix: "มูลนิธิ", jur_suffix: "" };
  if (code === "association") return { jur_prefix: "สมาคม", jur_suffix: "" };
  if (code === "joint_venture") return { jur_prefix: "กิจการร่วมค้า", jur_suffix: "" };
  if (code === "other") return { jur_prefix: "", jur_suffix: "" };
  return { jur_prefix: "บริษัท", jur_suffix: "จำกัด" };
}

function parseJuristicNameToBuilder(name?: string | null, code?: LegalFormCode | null) {
  const full = compactStr(name);
  const { jur_prefix, jur_suffix } = deriveJuristicPrefixSuffix(code);

  if (!full) return { jur_prefix, jur_suffix, jur_core: "" };

  let core = full;
  if (jur_prefix && core.startsWith(jur_prefix)) core = core.slice(jur_prefix.length).trim();
  if (jur_suffix && core.endsWith(jur_suffix)) core = core.slice(0, core.length - jur_suffix.length).trim();

  return { jur_prefix, jur_suffix, jur_core: core };
}

// ---------- Panel Title Helpers ----------
function displayPersonTitle(p: any, idx: number) {
  const name = [compactStr(p?.first_name), compactStr(p?.last_name)].filter(Boolean).join(" ").trim();
  const nick = compactStr(p?.nickname);
  const phone = compactStr(p?.phone);
  const email = compactStr(p?.email);
  const right = [nick ? `(${nick})` : "", phone, email].filter(Boolean).join(" • ");
  return name ? `#${idx + 1} ${name}${right ? ` — ${right}` : ""}` : `ผู้ติดต่อ #${idx + 1}`;
}

function displayContactTitle(c: any, idx: number) {
  const label = compactStr(c?.label);
  const ch = compactStr(c?.channel);
  const val = compactStr(c?.value);
  return `${label ? `${label} — ` : ""}${ch || "channel"}: ${val || `รายการ #${idx + 1}`}`;
}

function displayBankTitle(b: any, idx: number) {
  const bank = compactStr(b?.bank_name);
  const no = compactStr(b?.account_no);
  const name = compactStr(b?.account_name);
  return `${bank || `บัญชี #${idx + 1}`}${no ? ` • ${no}` : ""}${name ? ` • ${name}` : ""}`;
}

// ✅ แยกชุด option ตาม partyType
const JURISTIC_FORM_OPTIONS: Array<{ value: LegalFormCode; label: string }> = [
  { value: "company_limited", label: "บริษัทจำกัด" },
  { value: "public_company", label: "บริษัทมหาชนจำกัด" },
  { value: "limited_partnership", label: "ห้างหุ้นส่วนจำกัด (หจก.)" },
  { value: "foundation", label: "มูลนิธิ" },
  { value: "association", label: "สมาคม" },
  { value: "joint_venture", label: "กิจการร่วมค้า" },
  { value: "other", label: "อื่นๆ (นิติบุคคล)" },
];

const PERSONAL_FORM_OPTIONS: Array<{ value: LegalFormCode; label: string }> = [
  { value: "personal_individual", label: "บุคคลธรรมดา" },
  { value: "personal_ordinary_partnership", label: "ห้างหุ้นส่วนสามัญ" },
  { value: "personal_shop", label: "ร้านค้า" },
  { value: "personal_group", label: "คณะบุคคล" },
];

export default function VendorListPage() {
  const canManage = hasPermission("master.vendor.manage");
  const queryClient = useQueryClient();
  const QUERY_KEY = ["vendors"];

  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<string>("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("business");
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [duplicateTaxIdError, setDuplicateTaxIdError] = useState(false);

  const [form] = Form.useForm<FormValues>();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...QUERY_KEY, searchQuery, page, pageSize, sortKey, sortOrder],
    queryFn: () => listVendors({ q: searchQuery, page, limit: pageSize, sortKey, sortOrder }),
    enabled: !!canManage,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  function handleSearch() {
    setSearchQuery(q.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setQ("");
    setSearchQuery("");
    setPage(1);
  }

  const onTableChange: TableProps<VendorRow>["onChange"] = (pagination, _filters, sorter) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 20);

    if (Array.isArray(sorter)) return;
    const field = sorter.field as string;
    const order = sorter.order;

    if (field && order) {
      setSortKey(field);
      setSortOrder(order === "ascend" ? "asc" : "desc");
    } else {
      setSortKey("id");
      setSortOrder("desc");
    }
  };

  function ensureOnePrimaryExtraContacts() {
    const list = form.getFieldValue("extra_contacts") || [];
    if (!list.length) return;
    const any = list.some((c: any) => !!c?.is_primary);
    if (!any) {
      list[0].is_primary = true;
      form.setFieldsValue({ extra_contacts: [...list] });
    }
  }

  function ensureOneDefaultBank() {
    const list = form.getFieldValue("bank_accounts") || [];
    if (!list.length) return;
    const any = list.some((b: any) => !!b?.is_default);
    if (!any) {
      list[0].is_default = true;
      form.setFieldsValue({ bank_accounts: [...list] });
    }
  }

  function showDuplicateTaxIdError(messageText: string) {
    setActiveTab("business");
    form.setFields([{ name: ["business", "tax_no_13"], errors: [messageText] }]);
    setDuplicateTaxIdError(false);
    window.requestAnimationFrame(() => setDuplicateTaxIdError(true));
  }

  async function loadNextVendorCode(type: "VENDOR" | "CUSTOMER" | "BOTH" = "VENDOR") {
    try {
      setLoadingNextCode(true);
      const code = await getNextVendorCode(type);
      form.setFieldValue("code", code);
    } catch (e) {
      console.error(e);
      message.warning("โหลดรหัสผู้ขายถัดไปไม่สำเร็จ ระบบจะสร้างให้ตอนบันทึก", 2);
    } finally {
      setLoadingNextCode(false);
    }
  }

  async function openCreate() {
    setEditing(null);
    setActiveTab("business");
    setDuplicateTaxIdError(false);
    form.resetFields();

    const defaultLegalForm: LegalFormCode = "company_limited";
    const ps = deriveJuristicPrefixSuffix(defaultLegalForm);

    form.setFieldsValue({
      code: "",
      is_active: true,
      type: "VENDOR",
      business: {
        tax_country: "TH",
        branch_type: "na",
        party_type: "juristic",
        legal_form_code: defaultLegalForm,
        jur_prefix: ps.jur_prefix,
        jur_core: "",
        jur_suffix: ps.jur_suffix,

        personal_prefix: "คุณ",
        personal_first: "",
        personal_last: "",

        shop_name: "",
        group_name: "",
        tax_no_13: "",
      },
      registered_address: {},
      shipping_address: {},
      goods_shipping_address: {},
      contact_channels: {},
      people: [{ prefix: "คุณ", first_name: "", last_name: "", is_primary: true }],
      extra_contacts: [],
      bank_accounts: [{ bank_code: null, bank_name: "", account_name: "", account_no: "", branch_code: null, is_default: true }],
      payment_term: { type: "by_days", due_days: 0 },
    });

    setOpen(true);

    loadNextVendorCode("VENDOR");
  }

  function detailToForm(detail: VendorDetail) {
    const base: Record<string, string | null> = { email: null, phone: null, website: null, fax: null };
    (detail.contacts || []).forEach((c) => {
      if (c.channel in base && !base[c.channel]) base[c.channel] = c.value;
    });

    const extra = (detail.contacts || [])
      .filter((c) => !["email", "phone", "website", "fax"].includes(c.channel))
      .map((c) => ({
        label: c.label ?? "",
        channel: c.channel,
        value: c.value,
        is_primary: Number(c.is_primary ?? 0) === 1,
      }));
    if (extra.length && !extra.some((x) => x.is_primary)) extra[0].is_primary = true;

    const peopleSorted = [...(detail.people || [])].sort(
      (a, b) =>
        Number(b.is_primary ?? 0) - Number(a.is_primary ?? 0) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        Number(a.id ?? 0) - Number(b.id ?? 0)
    );
    const peopleForm = peopleSorted.slice(0, 5).map((p) => ({
      prefix: p.prefix ?? null,
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? null,
      nickname: p.nickname ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      position: p.position ?? null,
      department: (p as any).department ?? null,
      is_primary: Number(p.is_primary ?? 0) === 1,
    }));

    const party_type: PartyType = detail.legal_entity_type === "individual" ? "personal" : "juristic";
    const branch_type = (detail.office_type === "hq" ? "hq" : detail.office_type === "branch" ? "branch" : "na") as "hq" | "branch" | "na";

    const legal_form_code = mapBackLegalForm(detail.legal_form ?? null);

    const juristic_name = detail.business_name ?? null; // full name
    const personal_full = [detail.person_first_name, detail.person_last_name].filter(Boolean).join(" ").trim() || null;

    let jur_prefix: string | null = null;
    let jur_suffix: string | null = null;
    let jur_core: string | null = null;

    let personal_prefix: string | null = "คุณ";
    let personal_first: string | null = null;
    let personal_last: string | null = null;

    let shop_name: string | null = null;
    let group_name: string | null = null;

    if (party_type === "juristic") {
      const parsed = parseJuristicNameToBuilder(juristic_name, legal_form_code ?? undefined);
      jur_prefix = parsed.jur_prefix || null;
      jur_suffix = parsed.jur_suffix || null;
      jur_core = parsed.jur_core || null;
    } else {
      if (legal_form_code === "personal_shop") {
        const raw = compactStr(detail.name || "") || compactStr(juristic_name || "") || "";
        shop_name = raw.replace(/^ร้าน\s*/g, "").replace(/^ร้าน/g, "") || null;
        personal_prefix = null;
        personal_first = null;
        personal_last = null;
      } else if (legal_form_code === "personal_group") {
        const raw = compactStr(detail.name || "") || "";
        group_name = raw.replace(/^คณะบุคคล\s*/g, "").replace(/^คณะบุคคล/g, "") || null;
        personal_prefix = null;
        personal_first = null;
        personal_last = null;
      } else {
        const sp = splitFullName(personal_full ?? "");
        personal_first = sp.first || null;
        personal_last = sp.last || null;
        const primary = peopleForm.find((p) => p.is_primary) || peopleForm[0];
        personal_prefix = (primary?.prefix as any) ?? "คุณ";
      }
    }

    const ptType = (detail.payment_term?.type || (detail as any).payment_term_type || "by_days") as PaymentType;
    let payment_term: FormValues["payment_term"] = {
      type: "by_days",
      due_days: Number((detail.payment_term as any)?.due_days ?? (detail as any).payment_due_days ?? 0),
    };

    if (ptType === "by_month_day") {
      payment_term = { type: "by_month_day", month_day: Number((detail.payment_term as any)?.month_day ?? (detail as any).payment_month_day ?? 25) };
    } else if (ptType === "by_date") {
      payment_term = { type: "by_date", due_date: (detail as any).payment_due_date ? dayjs((detail as any).payment_due_date) : undefined };
    }

    const banks = (detail.bank_accounts || []).map((b) => ({
      bank_code: b.bank_code ?? null,
      bank_name: b.bank_name,
      account_name: b.account_name,
      account_no: b.account_no,
      branch_code: b.branch_code ?? null,
      is_default: Number(b.is_default ?? 0) === 1,
    }));
    if (banks.length && !banks.some((x) => x.is_default)) banks[0].is_default = true;

    // ✅ ถ้าเป็น juristic: ให้ ensure prefix/suffix ตาม legal_form เสมอ
    const lfForEdit = legal_form_code ?? (party_type === "juristic" ? "company_limited" : "personal_individual");
    const ps = party_type === "juristic" ? deriveJuristicPrefixSuffix(lfForEdit) : { jur_prefix: null as any, jur_suffix: null as any };

    form.setFieldsValue({
      code: detail.code,
      is_active: (detail.is_active ?? 1) === 1,
      type: (detail.type as any) ?? "VENDOR",
      business: {
        tax_no_13: detail.tax_id ?? "",
        tax_country: (detail.tax_country ?? "TH") as any,
        branch_type,
        party_type,
        legal_form_code: lfForEdit,

        jur_prefix: party_type === "juristic" ? ps.jur_prefix : null,
        jur_core: party_type === "juristic" ? (jur_core ?? "") : null,
        jur_suffix: party_type === "juristic" ? ps.jur_suffix : null,

        personal_prefix,
        personal_first: personal_first ?? "",
        personal_last: personal_last ?? "",

        shop_name: shop_name ?? "",
        group_name: group_name ?? "",
      },
      registered_address: {
        contact: detail.registered_address?.contact_name ?? null,
        address: detail.registered_address?.address_line ?? null,
        subdistrict: detail.registered_address?.subdistrict ?? null,
        district: detail.registered_address?.district ?? null,
        province: detail.registered_address?.province ?? null,
        postcode: detail.registered_address?.postcode ?? null,
      },
      shipping_address: {
        contact: detail.shipping_address?.contact_name ?? null,
        address: detail.shipping_address?.address_line ?? null,
        subdistrict: detail.shipping_address?.subdistrict ?? null,
        district: detail.shipping_address?.district ?? null,
        province: detail.shipping_address?.province ?? null,
        postcode: detail.shipping_address?.postcode ?? null,
      },
      goods_shipping_address: {
        contact: (detail as any).goods_shipping_address?.contact_name ?? null,
        phone: (detail as any).goods_shipping_address?.phone ?? null,
        address: (detail as any).goods_shipping_address?.address_line ?? null,
        subdistrict: (detail as any).goods_shipping_address?.subdistrict ?? null,
        district: (detail as any).goods_shipping_address?.district ?? null,
        province: (detail as any).goods_shipping_address?.province ?? null,
        postcode: (detail as any).goods_shipping_address?.postcode ?? null,
      },
      contact_channels: { email: base.email, phone: base.phone, website: base.website, fax: base.fax },
      people: peopleForm.length ? peopleForm : [{ prefix: "คุณ", first_name: "", last_name: "", is_primary: true }],
      extra_contacts: extra,
      bank_accounts: banks.length ? banks : [{ bank_code: null, bank_name: "", account_name: "", account_no: "", branch_code: null, is_default: true }],
      payment_term,
    });
  }

  async function openEdit(row: VendorRow) {
    setEditing(row);
    setActiveTab("business");
    setDuplicateTaxIdError(false);
    setOpen(true);
    setSaving(true);
    try {
      const detail = await getVendor(row.id);
      detailToForm(detail as any);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "โหลดรายละเอียด Vendor ไม่สำเร็จ", 2);
      setOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  function buildPrimaryContactsFromChannels(values: FormValues): VendorContact[] {
    const cc = values.contact_channels || {};
    const base: Array<{ channel: VendorContactChannel; value?: string | null }> = [
      { channel: "email", value: cc.email },
      { channel: "phone", value: cc.phone },
      { channel: "website", value: cc.website },
      { channel: "fax", value: cc.fax },
    ];

    const used = base.map((x) => ({ channel: x.channel, value: compactStr(x.value) })).filter((x) => x.value.length > 0);

    return used.map((x, idx) => ({
      label: null,
      channel: x.channel,
      value: x.value,
      is_primary: idx === 0 ? 1 : 0,
      sort_order: idx,
    }));
  }

  function buildPeopleList(values: FormValues): VendorPerson[] {
    const list = (values.people || [])
      .map((p) => ({
        prefix: p.prefix ?? null,
        first_name: compactStr(p.first_name),
        last_name: compactStr(p.last_name) || null,
        nickname: compactStr(p.nickname) || null,
        email: compactStr(p.email) || null,
        phone: compactStr(p.phone) || null,
        position: compactStr(p.position) || null,
        department: compactStr(p.department) || null,
        is_primary: p.is_primary ? 1 : 0,
      }))
      .filter((p) => p.first_name.length > 0)
      .slice(0, 5);

    if (!list.length) {
      const partyType = values.business?.party_type ?? "juristic";
      const legalForm = values.business?.legal_form_code ?? null;

      if (partyType === "personal") {
        if (legalForm === "personal_shop" || legalForm === "personal_group") {
          // noop
        } else {
          const personalPrefix = compactStr(values.business?.personal_prefix) || "คุณ";
          const full = buildPersonalName(personalPrefix, values.business?.personal_first ?? "", values.business?.personal_last ?? "");
          const sp = splitFullName(full);
          if (sp.first) {
            list.push({
              prefix: personalPrefix,
              first_name: sp.first,
              last_name: sp.last,
              nickname: null,
              email: null,
              phone: null,
              position: null,
              department: null,
              is_primary: 1,
            } as any);
          }
        }
      }
    }

    if (list.length) {
      const hasPrimary = list.some((p) => Number(p.is_primary) === 1);
      if (!hasPrimary) list[0].is_primary = 1;
    }

    return list.map((p, idx) => ({ ...p, sort_order: idx })) as VendorPerson[];
  }

  function normalizePayload(values: FormValues): VendorUpsert {
    // payment term
    let payment_term: VendorPaymentTerm | undefined;
    const pt = values.payment_term;
    const t = (pt?.type ?? "by_days") as PaymentType;

    if (t === "by_month_day") {
      const md = Number(pt?.month_day ?? 0);
      const safe = Math.min(Math.max(md, 1), 31);
      payment_term = { type: "by_month_day", month_day: safe };
    } else if (t === "by_date") {
      const d = pt?.due_date ? dayjs(pt.due_date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
      payment_term = { type: "by_date", due_date: d };
    } else {
      payment_term = { type: "by_days", due_days: Number(pt?.due_days ?? 0) };
    }

    const baseContacts = buildPrimaryContactsFromChannels(values);

    const extra = (values.extra_contacts || [])
      .map((c) => ({
        label: compactStr(c.label) || null,
        channel: c.channel,
        value: compactStr(c.value),
        is_primary: c.is_primary ? 1 : 0,
      }))
      .filter((c) => c.value.length > 0);

    if (extra.length && !extra.some((x) => x.is_primary === 1)) extra[0].is_primary = 1;

    const contacts: VendorContact[] = [...baseContacts, ...extra].slice(0, 5).map((c, idx) => ({ ...c, sort_order: idx }));

    const bank_accounts: VendorBankAccount[] = (values.bank_accounts || [])
      .filter((b) => compactStr(b.bank_name) && compactStr(b.account_name) && compactStr(b.account_no))
      .slice(0, 5)
      .map((b, idx) => ({
        bank_code: compactStr(b.bank_code) || null,
        bank_name: compactStr(b.bank_name),
        account_name: compactStr(b.account_name),
        account_no: compactStr(b.account_no),
        branch_code: compactStr(b.branch_code) || null,
        is_default: b.is_default ? 1 : 0,
        sort_order: idx,
      }));
    if (bank_accounts.length && !bank_accounts.some((x) => x.is_default === 1)) bank_accounts[0].is_default = 1;

    const biz = values.business || {};
    const partyType: PartyType = biz.party_type ?? "juristic";
    const legal_form = (biz.legal_form_code ?? null) as any;

    // ✅ displayName
    let displayName = "";
    if (partyType === "juristic") {
      const built = buildJuristicName(biz.jur_prefix, biz.jur_core, biz.jur_suffix);
      displayName = built || compactStr(biz.jur_core) || compactStr(values.code);
    } else {
      if (legal_form === "personal_shop") displayName = buildShopName(biz.shop_name) || compactStr(values.code);
      else if (legal_form === "personal_group") displayName = buildGroupName(biz.group_name) || compactStr(values.code);
      else displayName = buildPersonalName(biz.personal_prefix, biz.personal_first, biz.personal_last) || compactStr(values.code);
    }

    const office_type = mapOfficeType(biz.branch_type);
    const legal_entity_type = mapLegalEntityType(biz.party_type);

    const business_name = partyType === "juristic" ? (displayName || null) : null;

    let person_first_name: string | null = null;
    let person_last_name: string | null = null;

    if (partyType === "personal") {
      if (legal_form === "personal_shop" || legal_form === "personal_group") {
        person_first_name = null;
        person_last_name = null;
      } else {
        const first = compactStr(biz.personal_first);
        const last = compactStr(biz.personal_last);
        if (first || last) {
          person_first_name = first || null;
          person_last_name = last || null;
        } else {
          const sp = splitFullName(displayName);
          person_first_name = sp.first || null;
          person_last_name = sp.last || null;
        }
      }
    }

    const registered_address = {
      contact_name: compactStr(values.registered_address?.contact) || null,
      address_line: compactStr(values.registered_address?.address) || null,
      subdistrict: compactStr(values.registered_address?.subdistrict) || null,
      district: compactStr(values.registered_address?.district) || null,
      province: compactStr(values.registered_address?.province) || null,
      postcode: compactStr(values.registered_address?.postcode) || null,
      country: "TH",
    };

    const shipping_address = {
      contact_name: compactStr(values.shipping_address?.contact) || null,
      address_line: compactStr(values.shipping_address?.address) || null,
      subdistrict: compactStr(values.shipping_address?.subdistrict) || null,
      district: compactStr(values.shipping_address?.district) || null,
      province: compactStr(values.shipping_address?.province) || null,
      postcode: compactStr(values.shipping_address?.postcode) || null,
      country: "TH",
    };

    const goods_shipping_address = {
      contact_name: compactStr(values.goods_shipping_address?.contact) || null,
      phone: compactStr(values.goods_shipping_address?.phone) || null,
      address_line: compactStr(values.goods_shipping_address?.address) || null,
      subdistrict: compactStr(values.goods_shipping_address?.subdistrict) || null,
      district: compactStr(values.goods_shipping_address?.district) || null,
      province: compactStr(values.goods_shipping_address?.province) || null,
      postcode: compactStr(values.goods_shipping_address?.postcode) || null,
      country: "TH",
    };

    const legacy_tax_id = compactStr(biz.tax_no_13) || null;
    const legacy_phone = compactStr(values.contact_channels?.phone) || null;
    const legacy_email = compactStr(values.contact_channels?.email) || null;
    const legacy_address = compactStr(values.registered_address?.address) || null;

    const people = buildPeopleList(values);

    return {
      code: compactStr(values.code),
      name: displayName || compactStr(values.code),
      type: values.type || "VENDOR",

      tax_id: legacy_tax_id,
      tax_country: (String(biz.tax_country ?? "TH").toUpperCase()) as any,

      office_type,
      legal_entity_type,

      legal_form: legal_form ?? null,

      business_name,
      person_first_name,
      person_last_name,

      phone: legacy_phone,
      email: legacy_email,
      address: legacy_address,

      is_active: values.is_active ? 1 : 0,

      registered_address,
      shipping_address,
      goods_shipping_address,
      contacts,
      people,
      bank_accounts,
      payment_term,
    };
  }

  async function submit(_values: FormValues) {
    setSaving(true);
    try {
      const fullValues = form.getFieldsValue(true) as FormValues;
      const payload = normalizePayload(fullValues);
      if (!editing) delete payload.code;

      if ((payload.contacts?.length || 0) > 5) return message.error("ช่องทางติดต่อรวมได้ไม่เกิน 5", 2);
      if ((payload.bank_accounts?.length || 0) > 5) return message.error("ข้อมูลธนาคารได้ไม่เกิน 5 รายการ", 2);
      if ((payload.people?.length || 0) > 5) return message.error("ผู้ติดต่อได้ไม่เกิน 5 รายการ", 2);

      if ((payload.people?.length || 0) === 0) {
        message.error("กรอกข้อมูลผู้ติดต่ออย่างน้อย 1 รายการ (ชื่อจริง)", 2);
        setActiveTab("people");
        return;
      }

      if (payload.payment_term?.type === "by_month_day") {
        const md = Number((payload.payment_term as any).month_day);
        if (!md || md < 1 || md > 31) {
          message.error("กรุณาเลือกวันของเดือน (1 - 31)", 2);
          setActiveTab("payment");
          return;
        }
      }

      if (editing) {
        await updateVendor(editing.id, payload);
        message.success("บันทึกสำเร็จ", 1.2);
      } else {
        await createVendor(payload);
        message.success("สร้างสำเร็จ", 1.2);
      }

      setOpen(false);
      setDuplicateTaxIdError(false);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e: any) {
      const errorMessage = e?.response?.data?.message || "บันทึกไม่สำเร็จ";
      if (String(errorMessage).includes("มีเลขทะเบียน") && String(errorMessage).includes("อยู่ในระบบแล้ว")) {
        showDuplicateTaxIdError(errorMessage);
      }
      message.error(errorMessage, 2);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: VendorRow, next: boolean) {
    try {
      await setVendorActive(row.id, next ? 1 : 0);
      message.success("อัปเดตสถานะแล้ว", 1.2);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (e: any) {
      message.error(e?.response?.data?.message || "อัปเดตสถานะไม่สำเร็จ", 2);
    }
  }

  const columns: ColumnsType<VendorRow> = [
    { title: "ลำดับ", key: "no", width: 80, render: (_v, _r, idx) => <span className="text-gray-600">{idx + 1}</span> },
    {
      title: "รหัส",
      dataIndex: "code",
      key: "code",
      width: 160,
      sorter: (a, b) => (a.code || "").localeCompare(b.code || ""),
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      title: "ชื่อกิจการ/ผู้ขาย",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name || "").localeCompare(b.name || ""),
      render: (v: any, r: VendorRow) => (
        <div className="leading-tight">
          <div className="font-medium">{v}</div>
          <div className="text-xs text-gray-500">{r.tax_id ? `Tax ID: ${r.tax_id}` : ""}</div>
        </div>
      ),
    },
    {
      title: "สถานะ",
      dataIndex: "is_active",
      key: "is_active",
      width: 170,
      filters: [{ text: "Active", value: 1 }, { text: "Inactive", value: 0 }],
      onFilter: (val, record) => Number(record.is_active ?? 1) === Number(val),
      sorter: (a, b) => Number(a.is_active ?? 1) - Number(b.is_active ?? 1),
      render: (_: any, r: VendorRow) => {
        const active = (r.is_active ?? 1) === 1;
        return (
          <Space>
            <Tag color={active ? "green" : "default"}>{active ? "Active" : "Inactive"}</Tag>
            <Switch size="small" checked={active} disabled={!canManage} onChange={(v) => toggleActive(r, v)} />
          </Space>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_: any, r: VendorRow) => (
        <Button icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={!canManage}>
          แก้ไข
        </Button>
      ),
    },
  ];

  if (!canManage) {
    return (
      <Card>
        <Title level={4} className="!mb-1">
          Vendors
        </Title>
        <Text type="secondary">คุณไม่มีสิทธิ master.vendor.manage</Text>
      </Card>
    );
  }

  const partyType = Form.useWatch(["business", "party_type"], form) as PartyType | undefined;
  const paymentType = Form.useWatch(["payment_term", "type"], form) as PaymentType | undefined;
  const legalForm = Form.useWatch(["business", "legal_form_code"], form) as LegalFormCode | undefined;

  // ✅ เมื่อเปลี่ยนประเภทผู้ขาย: บังคับ set legal_form ให้ถูกฝั่ง และ reset field ที่ไม่เกี่ยวข้อง
  useEffect(() => {
    if (!open) return;

    const biz = form.getFieldValue("business") || {};
    if (partyType === "juristic") {
      const nextLf: LegalFormCode = isJuristicForm(legalForm ?? null) ? (legalForm as any) : "company_limited";
      const ps = deriveJuristicPrefixSuffix(nextLf);

      form.setFieldsValue({
        business: {
          ...biz,
          party_type: "juristic",
          legal_form_code: nextLf,
          jur_prefix: ps.jur_prefix,
          jur_suffix: ps.jur_suffix,
          jur_core: biz.jur_core ?? "",

          // reset personal/shop/group (กันค่าค้าง)
          personal_prefix: biz.personal_prefix ?? "คุณ",
          personal_first: "",
          personal_last: "",
          shop_name: "",
          group_name: "",
        },
      });
    }

    if (partyType === "personal") {
      const nextLf: LegalFormCode = isJuristicForm(legalForm ?? null) ? "personal_individual" : (legalForm ?? "personal_individual");

      form.setFieldsValue({
        business: {
          ...biz,
          party_type: "personal",
          legal_form_code: nextLf,

          // reset juristic (กันค่าค้าง)
          jur_prefix: null,
          jur_suffix: null,
          jur_core: "",

          personal_prefix: biz.personal_prefix ?? "คุณ",
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, open]);

  // ✅ เปลี่ยนรูปแบบผู้ขาย (ฝั่งนิติบุคคล) -> prefix/suffix เปลี่ยนตาม “ทุกครั้ง”
  useEffect(() => {
    if (!open) return;
    if (partyType !== "juristic") return;
    if (!legalForm) return;

    const biz = form.getFieldValue("business") || {};
    const ps = deriveJuristicPrefixSuffix(legalForm);

    form.setFieldsValue({
      business: {
        ...biz,
        jur_prefix: ps.jur_prefix,
        jur_suffix: ps.jur_suffix,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalForm, partyType, open]);

  const legalFormOptions = partyType === "personal" ? PERSONAL_FORM_OPTIONS : JURISTIC_FORM_OPTIONS;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Title level={3} className="!mb-1">
            ผู้ขาย / คู่ค้า
          </Title>
          <Text type="secondary">จัดการข้อมูลผู้ขาย + ที่อยู่ + ช่องทางติดต่อ + ผู้ติดต่อ + ธนาคาร + ครบกำหนดชำระ</Text>
        </div>

        <Space>
          <Input
            placeholder="ค้นหา รหัส/ชื่อ/Tax/เบอร์/อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 360 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={isLoading}>
            Search
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleClearSearch} disabled={!q && !searchQuery}>
            Clear
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            รีเฟรช
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            เพิ่มผู้ขาย
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          onChange={onTableChange}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
          }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? `แก้ไขผู้ขาย: ${editing.code}` : "เพิ่มผู้ขาย"}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          setDuplicateTaxIdError(false);
          setActiveTab("business");
          form.resetFields();
        }}
        okText={editing ? "บันทึก" : "สร้าง"}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnClose
        centered
        width={1040}
        className={duplicateTaxIdError ? "vendor-duplicate-tax-modal" : undefined}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={(changed) => {
            if (changed.business && "tax_no_13" in changed.business) {
              setDuplicateTaxIdError(false);
              form.setFields([{ name: ["business", "tax_no_13"], errors: [] }]);
            }
            if ("extra_contacts" in changed) ensureOnePrimaryExtraContacts();
            if ("bank_accounts" in changed) ensureOneDefaultBank();
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "business",
                label: "ข้อมูลกิจการ",
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item name="code" label="รหัสผู้ขาย">
                      <Input
                        disabled
                        placeholder={loadingNextCode ? "กำลังโหลดรหัสผู้ขาย..." : "ระบบสร้างให้อัตโนมัติ"}
                      />
                    </Form.Item>

                    <Form.Item name="is_active" label="สถานะ" valuePropName="checked">
                      <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>

                    <Form.Item 
                      name={["business", "tax_no_13"]} 
                      label="เลขทะเบียน 13 หลัก"
                      rules={[
                        { pattern: /^[0-9]{13}$/, message: "เลขทะเบียนต้องเป็นตัวเลข 13 หลัก" },
                        {
                          validator: (_, value) =>
                            isValidThaiNationalId(value)
                              ? Promise.resolve()
                              : Promise.reject(new Error("เลขทะเบียน 13 หลักไม่ถูกต้อง")),
                        },
                      ]}
                    >
                      <Input {...numericOnlyProps(13)} placeholder="13 หลัก" />
                    </Form.Item>

                    <Form.Item name={["business", "tax_country"]} label="ประเทศเลขทะเบียน">
                      <Radio.Group>
                        <Radio value="TH">ไทย</Radio>
                        <Radio value="OTHER">ประเทศอื่น</Radio>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item name={["business", "branch_type"]} label="ประเภทสาขา">
                      <Radio.Group>
                        <Radio value="hq">สำนักงานใหญ่</Radio>
                        <Radio value="branch">สาขา</Radio>
                        <Radio value="na">ไม่ระบุ</Radio>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item name="type" label="เป็นลูกค้า หรือ ผู้จำหน่าย">
                      <Radio.Group
                        onChange={(e) => {
                          if (!editing) loadNextVendorCode(e.target.value);
                        }}
                      >
                        <Radio value="VENDOR">ผู้จำหน่าย (ฝั่งซื้อ)</Radio>
                        <Radio value="CUSTOMER">ลูกค้า (ฝั่งขาย)</Radio>
                        <Radio value="BOTH">ทั้งคู่</Radio>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item name={["business", "party_type"]} label="ประเภทบุคคล/องค์กร">
                      <Radio.Group>
                        <Radio value="juristic">นิติบุคคล</Radio>
                        <Radio value="personal">บุคคลธรรมดา</Radio>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item
                      name={["business", "legal_form_code"]}
                      label="รูปแบบผู้ขาย"
                      rules={[{ required: true, message: "เลือกรูปแบบผู้ขาย" }]}
                    >
                      <Select
                        options={legalFormOptions}
                        placeholder="เลือก..."
                        // ✅ กันกรณีค่าเดิมไม่อยู่ใน options ฝั่งใหม่
                        onChange={(val) => {
                          const biz = form.getFieldValue("business") || {};
                          form.setFieldsValue({ business: { ...biz, legal_form_code: val } });
                        }}
                      />
                    </Form.Item>

                    <Form.Item shouldUpdate className="!mb-0 md:col-span-2">
                      {() => {
                        const lf = form.getFieldValue(["business", "legal_form_code"]) as LegalFormCode | null | undefined;
                        return (
                          <div className="text-xs text-gray-500">
                            รูปแบบที่เลือก: <span className="font-medium text-gray-700">{legalFormLabel(lf)}</span>
                          </div>
                        );
                      }}
                    </Form.Item>

                    {/* ✅ นิติบุคคล: ช่องเดียว + โชว์ prefix/suffix ใน input */}
                    {partyType === "juristic" ? (
                      <>
                        <Form.Item shouldUpdate className="md:col-span-2" label="ชื่อกิจการ" required>
                          {() => {
                            const biz = (form.getFieldValue("business") || {}) as FormValues["business"];
                            const addBefore = compactStr(biz?.jur_prefix);
                            const addAfter = compactStr(biz?.jur_suffix);

                            return (
                              <Form.Item
                                name={["business", "jur_core"]}
                                rules={[{ required: true, message: "กรอกชื่อกิจการ" }]}
                                className="!mb-0"
                              >
                                <Input
                                  placeholder="เช่น บิลด์มีอัพ คอนซัลแทนท์"
                                  addonBefore={addBefore || undefined}
                                  addonAfter={addAfter || undefined}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>

                        {/* ซ่อน prefix/suffix */}
                        <Form.Item name={["business", "jur_prefix"]} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item name={["business", "jur_suffix"]} hidden>
                          <Input />
                        </Form.Item>
                      </>
                    ) : (
                      <>
                        {/* ✅ บุคคล: แยกชุดของมันเอง */}
                        {legalForm === "personal_shop" ? (
                          <Form.Item className="md:col-span-2" name={["business", "shop_name"]} label="ชื่อร้าน" rules={[{ required: true, message: "กรอกชื่อร้าน" }]}>
                            <Input placeholder="เช่น บิลด์มีอัพ (ระบบจะใส่คำว่า 'ร้าน' ให้อัตโนมัติ)" />
                          </Form.Item>
                        ) : legalForm === "personal_group" ? (
                          <Form.Item className="md:col-span-2" name={["business", "group_name"]} label="ชื่อคณะบุคคล" rules={[{ required: true, message: "กรอกชื่อคณะบุคคล" }]}>
                            <Input placeholder="เช่น บิลด์มีอัพ กรุ๊ป (ระบบจะใส่ 'คณะบุคคล' ให้อัตโนมัติ)" />
                          </Form.Item>
                        ) : (
                          <>
                            <Form.Item name={["business", "personal_prefix"]} label="คำนำหน้า">
                              <Select options={PREFIX_OPTIONS} placeholder="เลือกคำนำหน้า" />
                            </Form.Item>

                            <Form.Item name={["business", "personal_first"]} label="ชื่อ" rules={[{ required: true, message: "กรอกชื่อ" }]}>
                              <Input placeholder="ชื่อ" />
                            </Form.Item>

                            <Form.Item name={["business", "personal_last"]} label="นามสกุล">
                              <Input placeholder="นามสกุล" />
                            </Form.Item>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ),
              },

              // ---------- reg ----------
              {
                key: "reg",
                label: "ที่อยู่จดทะเบียน",
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item name={["registered_address", "contact"]} label="ผู้ติดต่อ">
                      <Input placeholder="ชื่อผู้ติดต่อ" />
                    </Form.Item>
                    <div />
                    <Form.Item className="md:col-span-2" name={["registered_address", "address"]} label="ที่อยู่">
                      <Input.TextArea rows={3} placeholder="บ้านเลขที่ ซอย ถนน อาคาร ห้องเลขที่ ฯลฯ" />
                    </Form.Item>
                    <Form.Item name={["registered_address", "subdistrict"]} label="แขวง/ตำบล">
                      <Input />
                    </Form.Item>
                    <Form.Item name={["registered_address", "district"]} label="เขต/อำเภอ">
                      <Input />
                    </Form.Item>
                    <Form.Item name={["registered_address", "province"]} label="จังหวัด">
                      <Input />
                    </Form.Item>
                    <Form.Item name={["registered_address", "postcode"]} label="รหัสไปรษณีย์">
                      <Input {...numericOnlyProps(10)} />
                    </Form.Item>
                  </div>
                ),
              },

              // ---------- ship ----------
              {
                key: "ship",
                label: "ที่อยู่จัดส่งเอกสาร",
                children: (
                  <>
                    <Text type="secondary" className="block mb-4">
                      ใช้สำหรับออกเอกสารใบกำกับภาษี/ใบเสร็จรับเงิน (ไม่มีเบอร์โทรศัพท์)
                    </Text>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Form.Item name={["shipping_address", "contact"]} label="ผู้ติดต่อ">
                        <Input placeholder="ชื่อผู้ติดต่อ" />
                      </Form.Item>
                      <div />
                      <Form.Item className="md:col-span-2" name={["shipping_address", "address"]} label="ที่อยู่">
                        <Input.TextArea rows={3} placeholder="บ้านเลขที่ ซอย ถนน อาคาร ห้องเลขที่ ฯลฯ" />
                      </Form.Item>
                      <Form.Item name={["shipping_address", "subdistrict"]} label="แขวง/ตำบล">
                        <Input />
                      </Form.Item>
                      <Form.Item name={["shipping_address", "district"]} label="เขต/อำเภอ">
                        <Input />
                      </Form.Item>
                      <Form.Item name={["shipping_address", "province"]} label="จังหวัด">
                        <Input />
                      </Form.Item>
                      <Form.Item name={["shipping_address", "postcode"]} label="รหัสไปรษณีย์">
                        <Input {...numericOnlyProps(10)} />
                      </Form.Item>
                    </div>
                  </>
                ),
              },

              {
                key: "goods_ship",
                label: "ที่อยู่จัดส่งสินค้า",
                children: (
                  <>
                    <Text type="secondary" className="block mb-4">
                      ใช้สำหรับจัดส่งสินค้า (มีเบอร์โทรศัพท์)
                    </Text>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Form.Item name={["goods_shipping_address", "contact"]} label="ผู้ติดต่อ">
                        <Input placeholder="ชื่อผู้ติดต่อรับสินค้า" />
                      </Form.Item>
                      <Form.Item 
                        name={["goods_shipping_address", "phone"]} 
                        label="เบอร์โทรศัพท์"
                        rules={[
                          { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก" }
                        ]}
                      >
                        <Input {...numericOnlyProps(10)} placeholder="เบอร์โทรศัพท์สำหรับติดต่อรับของ" />
                      </Form.Item>
                      <Form.Item className="md:col-span-2" name={["goods_shipping_address", "address"]} label="ที่อยู่">
                        <Input.TextArea rows={3} placeholder="บ้านเลขที่ ซอย ถนน อาคาร ห้องเลขที่ ฯลฯ" />
                      </Form.Item>
                      <Form.Item name={["goods_shipping_address", "subdistrict"]} label="แขวง/ตำบล">
                        <Input placeholder="แขวง/ตำบล" />
                      </Form.Item>
                      <Form.Item name={["goods_shipping_address", "district"]} label="เขต/อำเภอ">
                        <Input placeholder="เขต/อำเภอ" />
                      </Form.Item>
                      <Form.Item name={["goods_shipping_address", "province"]} label="จังหวัด">
                        <Input placeholder="จังหวัด" />
                      </Form.Item>
                      <Form.Item name={["goods_shipping_address", "postcode"]} label="รหัสไปรษณีย์">
                        <Input {...numericOnlyProps(10)} placeholder="รหัสไปรษณีย์" />
                      </Form.Item>
                    </div>
                  </>
                ),
              },

              // ---------- channels ----------
              {
                key: "channels",
                label: "ช่องทางติดต่อ",
                children: (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Form.Item 
                        name={["contact_channels", "email"]} 
                        label="อีเมล"
                        rules={[
                          { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }
                        ]}
                      >
                        <Input placeholder="email@domain.com" />
                      </Form.Item>
                      <Form.Item 
                        name={["contact_channels", "phone"]} 
                        label="เบอร์โทร"
                        rules={[
                          { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก" }
                        ]}
                      >
                        <Input {...numericOnlyProps(10)} placeholder="09x-xxx-xxxx" />
                      </Form.Item>
                      <Form.Item name={["contact_channels", "website"]} label="เว็บไซต์">
                        <Input placeholder="www.website.com" />
                      </Form.Item>
                      <Form.Item name={["contact_channels", "fax"]} label="เบอร์แฟกซ์">
                        <Input {...numericOnlyProps(10)} placeholder="02-xxx-xxxx" />
                      </Form.Item>
                    </div>

                    <Divider className="!my-3" />
                    <Text type="secondary">เพิ่มช่องทางอื่นได้ (รวมทั้งหมดไม่เกิน 5 รายการเมื่อรวมกับ Email/เบอร์/Website/Fax)</Text>

                    <Form.List name="extra_contacts">
                      {(fields, { add, remove }) => (
                        <div className="space-y-3 mt-3">
                          <Button
                            type="dashed"
                            onClick={() => {
                              const list = form.getFieldValue("extra_contacts") || [];
                              if (list.length >= 5) return message.error("ช่องทางติดต่อรวมได้ไม่เกิน 5", 2);
                              add({ label: "", channel: "line", value: "", is_primary: list.length === 0 });
                            }}
                          >
                            + เพิ่มช่องทางอื่น
                          </Button>

                          <Collapse
                            accordion
                            bordered={false}
                            items={fields.map((f, idx) => ({
                              key: String(f.key),
                              label: (
                                <div className="flex items-center justify-between w-full">
                                  <div className="font-medium">
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const c = form.getFieldValue(["extra_contacts", f.name]) || {};
                                        return displayContactTitle(c, idx);
                                      }}
                                    </Form.Item>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const c = form.getFieldValue(["extra_contacts", f.name]) || {};
                                        return c?.is_primary ? <Tag color="blue">หลัก</Tag> : null;
                                      }}
                                    </Form.Item>

                                    <Button
                                      icon={<DeleteOutlined />}
                                      danger
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        remove(f.name);
                                        setTimeout(() => ensureOnePrimaryExtraContacts(), 0);
                                      }}
                                    />
                                  </div>
                                </div>
                              ),
                              children: (
                                <Card size="small" style={{ borderRadius: 12 }}>
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <Form.Item className="md:col-span-3" name={[f.name, "label"]} label="ชื่อช่องทาง">
                                      <Input placeholder="เช่น ฝ่ายขาย/บัญชี" maxLength={100} />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-3" name={[f.name, "channel"]} label="ประเภท">
                                      <Select options={[{ value: "line", label: "LINE" }, { value: "facebook", label: "Facebook" }, { value: "other", label: "อื่นๆ" }]} />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-5" name={[f.name, "value"]} label="ข้อมูล" rules={[{ required: true, message: "กรอกข้อมูลติดต่อ" }]}>
                                      <Input placeholder="line id / fb / อื่นๆ" />
                                    </Form.Item>

                                    <div className="md:col-span-1 flex justify-end">
                                      <Form.Item name={[f.name, "is_primary"]} valuePropName="checked" className="!mb-0">
                                        <Switch
                                          size="small"
                                          checkedChildren="หลัก"
                                          unCheckedChildren="รอง"
                                          onChange={(checked) => {
                                            const list = form.getFieldValue("extra_contacts") || [];
                                            if (checked) {
                                              form.setFieldsValue({ extra_contacts: list.map((c: any, i: number) => ({ ...c, is_primary: i === f.name })) });
                                            } else {
                                              const next = list.map((c: any, i: number) => ({ ...c, is_primary: i === f.name ? false : c?.is_primary }));
                                              const stillAny = next.some((x: any) => x?.is_primary);
                                              if (!stillAny && next.length) next[0].is_primary = true;
                                              form.setFieldsValue({ extra_contacts: next });
                                            }
                                          }}
                                        />
                                      </Form.Item>
                                    </div>
                                  </div>
                                </Card>
                              ),
                            }))}
                          />
                        </div>
                      )}
                    </Form.List>
                  </>
                ),
              },

              // ---------- people ----------
              {
                key: "people",
                label: "ข้อมูลผู้ติดต่อ",
                children: (
                  <>
                    <div className="flex items-center justify-between">
                      <Text type="secondary">เพิ่มผู้ติดต่อได้สูงสุด 5 รายการ (เลือก “หลัก” ได้ 1 คน)</Text>

                      <Form.Item shouldUpdate className="!mb-0">
                        {() => {
                          const current = form.getFieldValue("people") || [];
                          const canAdd = current.length < 5;
                          return (
                            <Button
                              type="primary"
                              onClick={() => {
                                const list = form.getFieldValue("people") || [];
                                if (list.length >= 5) return;
                                form.setFieldsValue({ people: [...list, { prefix: "คุณ", first_name: "", last_name: "", is_primary: list.length === 0 }] });
                              }}
                              disabled={!canAdd}
                            >
                              + เพิ่มผู้ติดต่อ
                            </Button>
                          );
                        }}
                      </Form.Item>
                    </div>

                    <Divider className="!my-3" />

                    <Form.List name="people">
                      {(fields, { add, remove }) => (
                        <div className="space-y-3">
                          <Collapse
                            accordion
                            bordered={false}
                            defaultActiveKey={fields.length ? [String(fields[0].key)] : undefined}
                            items={fields.map((f, idx) => ({
                              key: String(f.key),
                              label: (
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const p = form.getFieldValue(["people", f.name]) || {};
                                        return <div className="font-medium">{displayPersonTitle(p, idx)}</div>;
                                      }}
                                    </Form.Item>
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const p = form.getFieldValue(["people", f.name]) || {};
                                        return p?.is_primary ? <Tag color="blue">หลัก</Tag> : null;
                                      }}
                                    </Form.Item>
                                  </div>

                                  <Button
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      remove(f.name);
                                    }}
                                    disabled={fields.length <= 1}
                                  />
                                </div>
                              ),
                              children: (
                                <Card size="small" style={{ borderRadius: 12 }}>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 [&_.ant-form-item]:!mb-2">
                                    <Form.Item name={[f.name, "prefix"]} label="คำนำหน้า">
                                      <Select options={PREFIX_OPTIONS} allowClear placeholder="เลือกคำนำหน้า" />
                                    </Form.Item>

                                    <Form.Item label="ตั้งเป็นหลัก">
                                      <Form.Item name={[f.name, "is_primary"]} valuePropName="checked" className="!mb-0">
                                        <Switch
                                          checkedChildren="หลัก"
                                          unCheckedChildren="รอง"
                                          onChange={(checked) => {
                                            if (checked) {
                                              const list = (form.getFieldValue("people") || []).map((p: any, i: number) => ({ ...p, is_primary: i === idx }));
                                              form.setFieldsValue({ people: list });
                                            } else {
                                              const list = form.getFieldValue("people") || [];
                                              const stillAny = list.some((p: any, i: number) => i !== idx && p?.is_primary);
                                              if (!stillAny && list.length) {
                                                const next = list.map((p: any, i: number) => ({ ...p, is_primary: i === idx }));
                                                form.setFieldsValue({ people: next });
                                              }
                                            }
                                          }}
                                        />
                                      </Form.Item>
                                    </Form.Item>

                                    <Form.Item name={[f.name, "first_name"]} label="ชื่อจริง" rules={[{ required: idx === 0, message: "กรอกชื่อจริงอย่างน้อย 1 รายการ" }]}>
                                      <Input placeholder="ชื่อจริง" />
                                    </Form.Item>

                                    <Form.Item name={[f.name, "last_name"]} label="นามสกุล">
                                      <Input placeholder="นามสกุล" />
                                    </Form.Item>

                                    <Form.Item name={[f.name, "nickname"]} label="ชื่อเล่น">
                                      <Input placeholder="ชื่อเล่น" />
                                    </Form.Item>

                                    <Form.Item 
                                      name={[f.name, "email"]} 
                                      label="อีเมลล์"
                                      rules={[
                                        { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }
                                      ]}
                                    >
                                      <Input placeholder="example@email.com" />
                                    </Form.Item>

                                    <Form.Item 
                                      name={[f.name, "phone"]} 
                                      label="เบอร์โทร"
                                      rules={[
                                        { pattern: /^[0-9]{9,10}$/, message: "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก" }
                                      ]}
                                    >
                                      <Input {...numericOnlyProps(10)} placeholder="09x-xxx-xxxx" />
                                    </Form.Item>

                                    <Form.Item name={[f.name, "position"]} label="ตำแหน่งงาน">
                                      <Input placeholder="เช่น ฝ่ายขาย / บัญชี" />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-2" name={[f.name, "department"]} label="แผนก">
                                      <Input placeholder="แผนก" />
                                    </Form.Item>
                                  </div>
                                </Card>
                              ),
                            }))}
                          />

                          <Button type="dashed" block onClick={() => add({ prefix: "คุณ", first_name: "", last_name: "", is_primary: fields.length === 0 })} disabled={fields.length >= 5}>
                            + เพิ่มผู้ติดต่อ (สูงสุด 5)
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </>
                ),
              },

              // ---------- bank ----------
              {
                key: "bank",
                label: "ข้อมูลธนาคาร",
                children: (
                  <>
                    <Text type="secondary">เพิ่มได้สูงสุด 5 รายการ</Text>
                    <Divider className="!my-3" />

                    <Form.List name="bank_accounts">
                      {(fields, { add, remove }) => (
                        <div className="space-y-3">
                          <Button
                            type="dashed"
                            onClick={() => {
                              const list = form.getFieldValue("bank_accounts") || [];
                              if (list.length >= 5) return message.error("ข้อมูลธนาคารได้ไม่เกิน 5 รายการ", 2);
                              add({ bank_code: null, bank_name: "", account_name: "", account_no: "", branch_code: null, is_default: list.length === 0 });
                            }}
                            disabled={fields.length >= 5}
                          >
                            + เพิ่มบัญชีธนาคาร
                          </Button>

                          <Collapse
                            accordion
                            bordered={false}
                            items={fields.map((f, idx) => ({
                              key: String(f.key),
                              label: (
                                <div className="flex items-center justify-between w-full">
                                  <div className="font-medium">
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const b = form.getFieldValue(["bank_accounts", f.name]) || {};
                                        return displayBankTitle(b, idx);
                                      }}
                                    </Form.Item>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Form.Item noStyle shouldUpdate>
                                      {() => {
                                        const b = form.getFieldValue(["bank_accounts", f.name]) || {};
                                        return b?.is_default ? <Tag color="blue">หลัก</Tag> : null;
                                      }}
                                    </Form.Item>

                                    <Button
                                      icon={<DeleteOutlined />}
                                      danger
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        remove(f.name);
                                        setTimeout(() => ensureOneDefaultBank(), 0);
                                      }}
                                    />
                                  </div>
                                </div>
                              ),
                              children: (
                                <Card key={f.key} size="small" style={{ borderRadius: 12 }}>
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                    <Form.Item className="md:col-span-3" name={[f.name, "bank_name"]} label="ธนาคาร" rules={[{ required: true }]}>
                                      <Select showSearch placeholder="เลือกธนาคาร" options={THAI_BANKS.map((b) => ({ value: b, label: b }))} />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-4" name={[f.name, "account_name"]} label="ชื่อบัญชี" rules={[{ required: true }]}>
                                      <Input maxLength={150} />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-3" name={[f.name, "account_no"]} label="เลขที่บัญชี" rules={[{ required: true }]}>
                                      <Input maxLength={50} />
                                    </Form.Item>

                                    <Form.Item className="md:col-span-2" name={[f.name, "branch_code"]} label="เลขที่สาขา">
                                      <Input {...numericOnlyProps(20)} />
                                    </Form.Item>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-gray-500">ตั้งเป็นบัญชีหลัก</div>
                                    <Form.Item name={[f.name, "is_default"]} valuePropName="checked" className="!mb-0">
                                      <Switch
                                        size="small"
                                        checkedChildren="หลัก"
                                        unCheckedChildren="รอง"
                                        onChange={(checked) => {
                                          const list = form.getFieldValue("bank_accounts") || [];
                                          if (checked) {
                                            form.setFieldsValue({ bank_accounts: list.map((b: any, i: number) => ({ ...b, is_default: i === f.name })) });
                                          } else {
                                            const next = list.map((b: any, i: number) => ({ ...b, is_default: i === f.name ? false : b?.is_default }));
                                            const stillAny = next.some((x: any) => x?.is_default);
                                            if (!stillAny && next.length) next[0].is_default = true;
                                            form.setFieldsValue({ bank_accounts: next });
                                          }
                                        }}
                                      />
                                    </Form.Item>
                                  </div>
                                </Card>
                              ),
                            }))}
                          />
                        </div>
                      )}
                    </Form.List>
                  </>
                ),
              },

              // ---------- payment ----------
              {
                key: "payment",
                label: "ครบกำหนดชำระ",
                children: (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item name={["payment_term", "type"]} label="รูปแบบการครบกำหนด" initialValue="by_days">
                      <Select
                        options={[
                          { value: "by_days", label: "กำหนดเป็นจำนวนวัน (นับจากวันที่เอกสาร)" },
                          { value: "by_month_day", label: "กำหนดเป็นวันของทุกเดือน (เช่น ทุกวันที่ 25)" },
                          { value: "by_date", label: "กำหนดเป็นวันที่แน่ชัด (Legacy)" },
                        ]}
                        onChange={(val) => {
                          if (val === "by_month_day") form.setFieldsValue({ payment_term: { type: "by_month_day", month_day: form.getFieldValue(["payment_term", "month_day"]) ?? 25 } });
                          else if (val === "by_date") form.setFieldsValue({ payment_term: { type: "by_date", due_date: dayjs().add(1, "month").startOf("month") } });
                          else form.setFieldsValue({ payment_term: { type: "by_days", due_days: form.getFieldValue(["payment_term", "due_days"]) ?? 0 } });
                        }}
                      />
                    </Form.Item>

                    {paymentType === "by_month_day" ? (
                      <Form.Item name={["payment_term", "month_day"]} label="วันของเดือน (ตั้งค่าเป็นกติกา)" rules={[{ required: true, message: "เลือกวันของเดือน 1 - 31" }]}>
                        <Select options={MONTH_DAYS_OPTIONS} placeholder="เลือกวันของเดือน" />
                      </Form.Item>
                    ) : paymentType === "by_date" ? (
                      <Form.Item name={["payment_term", "due_date"]} label="วันที่ครบกำหนด (Legacy)">
                        <DatePicker className="w-full" />
                      </Form.Item>
                    ) : (
                      <Form.Item name={["payment_term", "due_days"]} label="ครบกำหนด (วัน)" initialValue={0}>
                        <InputNumber
                          className="w-full"
                          min={0}
                          max={3650}
                          controls={false}
                          inputMode="numeric"
                          onKeyDown={(e) => {
                            const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
                            if (allowedKeys.includes(e.key) || e.metaKey || e.ctrlKey) return;
                            if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (!/^[0-9]+$/.test(text)) e.preventDefault();
                          }}
                        />
                      </Form.Item>
                    )}

                    <div className="md:col-span-2 text-xs text-gray-500">
                      * “กำหนดเป็นจำนวนวัน” = ระบบคำนวณ due_date = issue_date + X วัน <br />
                      * “กำหนดเป็นวันของทุกเดือน” = ระบบคำนวณ due_date จาก issue_date ว่า “วันนั้นของเดือนนี้/เดือนถัดไป”
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
}

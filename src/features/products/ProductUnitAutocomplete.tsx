import { useEffect, useMemo, useState } from "react";
import { AutoComplete } from "antd";
import { listProductUnits } from "./productApi";

type ProductUnitAutocompleteProps = {
  value?: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
};

export default function ProductUnitAutocomplete({
  value,
  onChange,
  disabled,
}: ProductUnitAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = window.setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await listProductUnits(search.trim() || undefined);
        setUnits(rows.map((row) => row.name).filter(Boolean));
      } catch (e) {
        console.error(e);
        setUnits([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handler);
  }, [search]);

  const options = useMemo(() => {
    const current = String(value || "").trim();
    const unique = new Set(units);
    if (current && !unique.has(current)) unique.add(current);

    return Array.from(unique).map((unit) => ({ value: unit, label: unit }));
  }, [units, value]);

  return (
    <AutoComplete
      value={value || ""}
      options={options}
      disabled={disabled}
      allowClear
      placeholder="เช่น ชิ้น, กล่อง, แพ็ค"
      notFoundContent={loading ? "กำลังโหลด..." : "พิมพ์หน่วยใหม่เพื่อเพิ่ม"}
      filterOption={false}
      onSearch={setSearch}
      onChange={(next) => onChange?.(String(next || "").trim() || null)}
      onFocus={() => setSearch("")}
      className="w-full"
    />
  );
}

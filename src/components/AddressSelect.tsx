import { useState, useMemo, useEffect } from "react";
import { AutoComplete, Input, Row, Col, Form } from "antd";
import provinceData from "../data/province.json";
import districtData from "../data/district.json";
import subDistrictData from "../data/sub_district_with_district_and_province.json";

interface AddressSelectProps {
  value?: {
    province?: string | null;
    district?: string | null;
    sub_district?: string | null;
    zip_code?: string | null;
  };
  onChange?: (val: {
    province: string | null;
    district: string | null;
    sub_district: string | null;
    zip_code: string | null;
  }) => void;
  disabled?: boolean;
}

export default function AddressSelect({ value, onChange, disabled }: AddressSelectProps) {
  const [internalVal, setInternalVal] = useState({
    province: value?.province || "",
    district: value?.district || "",
    sub_district: value?.sub_district || "",
    zip_code: value?.zip_code || "",
  });

  useEffect(() => {
    if (value) {
      setInternalVal({
        province: value.province || "",
        district: value.district || "",
        sub_district: value.sub_district || "",
        zip_code: value.zip_code || "",
      });
    }
  }, [value]);

  const triggerChange = (newVal: typeof internalVal) => {
    setInternalVal(newVal);
    if (onChange) {
      onChange({
        province: newVal.province || null,
        district: newVal.district || null,
        sub_district: newVal.sub_district || null,
        zip_code: newVal.zip_code || null,
      });
    }
  };

  // Searching logic for sub_districts (tambons)
  const searchOptions = (searchText: string) => {
    if (!searchText || searchText.length < 2) return [];

    const qs = searchText.trim().toLowerCase();
    
    // Search mostly by sub-district name or zip code
    const subDistricts = subDistrictData as any[];
    const results = subDistricts.filter((item: any) => {
      return (
        item.name_th.includes(qs) ||
        String(item.zip_code).includes(qs) ||
        item.district?.name_th.includes(qs)
      );
    }).slice(0, 50); // limit to 50 for performance

    return results.map((item: any) => {
      const provinceName = item.district?.province?.name_th || "";
      const districtName = item.district?.name_th || "";
      const subDistrictName = item.name_th || "";
      const zipCode = item.zip_code || "";

      // Handle BKK wording
      const isBkk = provinceName === "กรุงเทพมหานคร";
      const pPrefix = isBkk ? "" : "จ.";
      const dPrefix = isBkk ? "เขต" : "อ.";
      const sPrefix = isBkk ? "แขวง" : "ต.";

      const display = `${sPrefix}${subDistrictName} ${dPrefix}${districtName.replace('เขต', '')} ${pPrefix}${provinceName} ${zipCode}`;

      return {
        value: display,
        label: display,
        data: {
          province: provinceName,
          district: districtName,
          sub_district: subDistrictName,
          zip_code: String(zipCode),
        },
      };
    });
  };

  const [options, setOptions] = useState<any[]>([]);

  const onSearch = (text: string) => {
    setOptions(searchOptions(text));
  };

  const onSelect = (_val: string, option: any) => {
    const data = option.data;
    triggerChange({
      province: data.province,
      district: data.district,
      sub_district: data.sub_district,
      zip_code: data.zip_code,
    });
    // Clear search options after select
    setOptions([]);
  };

  // Province dropdown
  const provinceOptions = useMemo(() => {
    return provinceData.map((p: any) => ({
      value: p.name_th,
      label: p.name_th,
      id: p.id
    }));
  }, []);

  // District dropdown based on selected province
  const districtOptions = useMemo(() => {
    const selectedProvince = provinceData.find((p: any) => p.name_th === internalVal.province);
    if (!selectedProvince) return [];
    
    return districtData
      .filter((d: any) => d.province_id === selectedProvince.id)
      .map((d: any) => ({
        value: d.name_th,
        label: d.name_th,
      }));
  }, [internalVal.province]);

  const handleChange = (field: keyof typeof internalVal, val: string) => {
    const newVal = { ...internalVal, [field]: val };
    
    // Clear dependents if higher level changes
    if (field === "province") {
      newVal.district = "";
      newVal.sub_district = "";
      newVal.zip_code = "";
    } else if (field === "district") {
      newVal.sub_district = "";
      newVal.zip_code = "";
    }

    triggerChange(newVal);
  };

  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหาที่อยู่อัตโนมัติ (พิมพ์ ตำบล, เขต/อำเภอ, หรือ รหัสไปรษณีย์)</label>
        <AutoComplete
          className="w-full"
          options={options}
          onSelect={onSelect}
          onSearch={onSearch}
          disabled={disabled}
          placeholder="ค้นหาด่วน เช่น บางซื่อ, 10800..."
        >
          <Input.Search size="large" />
        </AutoComplete>
      </div>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="จังหวัด" className="mb-2">
            <AutoComplete
              options={provinceOptions}
              value={internalVal.province}
              onChange={(val) => handleChange("province", val)}
              placeholder="จังหวัด"
              disabled={disabled}
              filterOption={(inputValue, option) =>
                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="เขต/อำเภอ" className="mb-2">
            <AutoComplete
              options={districtOptions}
              value={internalVal.district}
              onChange={(val) => handleChange("district", val)}
              placeholder="เขต/อำเภอ"
              disabled={disabled}
              filterOption={(inputValue, option) =>
                option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="แขวง/ตำบล" className="mb-0">
            <Input
              value={internalVal.sub_district}
              onChange={(e) => handleChange("sub_district", e.target.value)}
              placeholder="แขวง/ตำบล"
              disabled={disabled}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="รหัสไปรษณีย์" className="mb-0">
            <Input
              value={internalVal.zip_code}
              onChange={(e) => handleChange("zip_code", e.target.value)}
              placeholder="รหัสไปรษณีย์"
              disabled={disabled}
              maxLength={5}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
}

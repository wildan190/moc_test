import { Button, Card, Divider, Select, Space, Statistic, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { Outlet } from "../types";

type PosOverviewProps = {
  outlets: Outlet[];
  outletId: string;
  revenue: number;
  transactionCount: number;
  onOutletChange: (outletId: string) => void;
  onAddProduct: () => void;
};

export default function PosOverview({
  outlets,
  outletId,
  revenue,
  transactionCount,
  onOutletChange,
  onAddProduct,
}: PosOverviewProps) {
  return (
    <Card
      variant="borderless"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      styles={{ body: { padding: "14px 20px" } }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Space>
          <Select
            value={outletId}
            onChange={onOutletChange}
            style={{ width: 190 }}
            options={outlets.map((outlet) => ({
              label: outlet.name,
              value: outlet.id,
            }))}
          />
          <Tag color="cyan">{outlets.find((o) => o.id === outletId)?.name}</Tag>
        </Space>

        <Space>
          <Statistic
            title="Omzet Hari Ini"
            value={revenue}
            precision={0}
            prefix="Rp"
            styles={{
              content: { fontSize: 16, color: "#1677ff", fontWeight: "bold" },
            }}
          />
          <Divider orientation="vertical" style={{ height: 32 }} />
          <Statistic
            title="Transaksi"
            value={transactionCount}
            styles={{ content: { fontSize: 16, fontWeight: "bold" } }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddProduct}
            style={{ marginLeft: 8 }}
          >
            Tambah Menu
          </Button>
        </Space>
      </div>
    </Card>
  );
}

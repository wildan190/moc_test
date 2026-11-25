import { Card, Col, Input, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import type { Sale } from "../types";
import { money } from "../utils";

const { Text } = Typography;

export type SalesReportTabProps = {
  sales: Sale[];
  revenue: number;
  date: string;
  onDateChange: (date: string) => void;
};

export default function SalesReportTab({
  sales,
  revenue,
  date,
  onDateChange,
}: SalesReportTabProps) {
  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Omzet Bersih"
              value={revenue}
              precision={0}
              prefix="Rp"
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Total Transaksi"
              value={sales.length}
              suffix="Struk"
              styles={{ content: { color: "#1677ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless">
            <Statistic
              title="Total Diskon Diberikan"
              value={sales.reduce((sum, sale) => sum + Number(sale.discount), 0)}
              prefix="Rp"
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        title="Daftar Struk Penjualan"
        extra={
          <Space>
            <Text>Tanggal:</Text>
            <Input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              style={{ width: 160 }}
            />
          </Space>
        }
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      >
        <Table
          dataSource={sales}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: "Nomor Struk",
              dataIndex: "receipt_number",
              key: "receipt_number",
              render: (receiptNumber) => <Text strong>{receiptNumber}</Text>,
            },
            {
              title: "Waktu",
              dataIndex: "created_at",
              key: "created_at",
              render: (createdAt) =>
                new Date(createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            },
            {
              title: "Metode",
              dataIndex: "payment_method",
              key: "payment_method",
              render: (method) => (
                <Tag color="blue">{String(method).toUpperCase()}</Tag>
              ),
            },
            {
              title: "Diskon",
              dataIndex: "discount",
              key: "discount",
              render: (discount) => money(Number(discount)),
            },
            {
              title: "Total",
              dataIndex: "total",
              key: "total",
              render: (total) => (
                <Text strong style={{ color: "#1677ff" }}>
                  {money(Number(total))}
                </Text>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

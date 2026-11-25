import type { FormEvent } from "react";
import { Button, Card, Col, Input, Row, Space, Table, Tag, Typography } from "antd";
import type { Customer, CustomerForm } from "../types";
import { money } from "../utils";

const { Text } = Typography;

export type CustomersTabProps = {
  customers: Customer[];
  customerForm: CustomerForm;
  onCustomerFormChange: (form: CustomerForm) => void;
  onCreateCustomer: (event: FormEvent<HTMLFormElement>) => void;
};

export default function CustomersTab({
  customers,
  customerForm,
  onCustomerFormChange,
  onCreateCustomer,
}: CustomersTabProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <Card
          variant="borderless"
          title="Daftar Member & Poin Pelanggan"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <Table
            dataSource={customers}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: "Nama",
                dataIndex: "name",
                key: "name",
                render: (name) => <Text strong>{name}</Text>,
              },
              {
                title: "No. Telepon",
                dataIndex: "phone",
                key: "phone",
              },
              {
                title: "Poin Loyalti",
                dataIndex: "points",
                key: "points",
                render: (points) => <Tag color="purple">{points} Poin</Tag>,
              },
              {
                title: "Total Belanja",
                dataIndex: "total_spent",
                key: "total_spent",
                render: (spent) => money(Number(spent)),
              },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={9}>
        <Card
          variant="borderless"
          title="Daftarkan Pelanggan Baru"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <form onSubmit={onCreateCustomer}>
            <Space
              orientation="vertical"
              size="middle"
              style={{ width: "100%" }}
            >
              <div>
                <Text strong>Nama Lengkap</Text>
                <Input
                  placeholder="Contoh: Budi Santoso"
                  required
                  value={customerForm.name}
                  onChange={(event) =>
                    onCustomerFormChange({
                      ...customerForm,
                      name: event.target.value,
                    })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <Text strong>Nomor WhatsApp / HP</Text>
                <Input
                  placeholder="Contoh: 08123456789"
                  required
                  value={customerForm.phone}
                  onChange={(event) =>
                    onCustomerFormChange({
                      ...customerForm,
                      phone: event.target.value,
                    })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>
              <Button type="primary" htmlType="submit" block size="large">
                Daftarkan Member
              </Button>
            </Space>
          </form>
        </Card>
      </Col>
    </Row>
  );
}

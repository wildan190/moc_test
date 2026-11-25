import { Col, Row, Tabs } from "antd";
import {
  CalendarOutlined,
  InboxOutlined,
  LineChartOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import ActiveOrderPanel, {
  type ActiveOrderPanelProps,
} from "./ActiveOrderPanel";
import CustomersTab, { type CustomersTabProps } from "./CustomersTab";
import InventoryTab, { type InventoryTabProps } from "./InventoryTab";
import ProductCatalog, { type ProductCatalogProps } from "./ProductCatalog";
import ReservationsTab, {
  type ReservationsTabProps,
} from "./ReservationsTab";
import SalesReportTab, { type SalesReportTabProps } from "./SalesReportTab";

type PosTabsProps = {
  activeTab: string;
  onTabChange: (key: string) => void;
  catalog: ProductCatalogProps;
  order: ActiveOrderPanelProps;
  inventory: InventoryTabProps;
  report: SalesReportTabProps;
  customers: CustomersTabProps;
  reservations: ReservationsTabProps;
};

export default function PosTabs({
  activeTab,
  onTabChange,
  catalog,
  order,
  inventory,
  report,
  customers,
  reservations,
}: PosTabsProps) {
  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      type="card"
      items={[
        {
          key: "kasir",
          label: (
            <span>
              <ShoppingCartOutlined /> Kasir (POS)
            </span>
          ),
          children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={15} xl={16}>
                <ProductCatalog {...catalog} />
              </Col>
              <Col xs={24} lg={9} xl={8}>
                <ActiveOrderPanel {...order} />
              </Col>
            </Row>
          ),
        },
        {
          key: "persediaan",
          label: (
            <span>
              <InboxOutlined /> Menu & Persediaan
            </span>
          ),
          children: <InventoryTab {...inventory} />,
        },
        {
          key: "laporan",
          label: (
            <span>
              <LineChartOutlined /> Laporan Penjualan
            </span>
          ),
          children: <SalesReportTab {...report} />,
        },
        {
          key: "pelanggan",
          label: (
            <span>
              <TeamOutlined /> Pelanggan Loyal
            </span>
          ),
          children: <CustomersTab {...customers} />,
        },
        {
          key: "reservasi",
          label: (
            <span>
              <CalendarOutlined /> Reservasi Meja
            </span>
          ),
          children: <ReservationsTab {...reservations} />,
        },
      ]}
    />
  );
}

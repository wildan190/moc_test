import { Button, Card, Space, Table, Tag, Typography } from "antd";
import { EditOutlined, InboxOutlined, PlusOutlined } from "@ant-design/icons";
import type { Product } from "../types";
import { money, photoHref } from "../utils";

const { Text } = Typography;

export type InventoryTabProps = {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onAdjustStock: (product: Product, amount: number) => void;
};

export default function InventoryTab({
  products,
  onAddProduct,
  onEditProduct,
  onAdjustStock,
}: InventoryTabProps) {
  return (
    <Card
      variant="borderless"
      title="Katalog Menu & Manajemen Stok"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddProduct}
        >
          Tambah Menu Baru
        </Button>
      }
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <Table
        dataSource={products}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: "Menu",
            key: "name",
            render: (_, product) => {
              const src = photoHref(product.photo_url);
              return (
                <Space>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#f5f5f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={product.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <InboxOutlined style={{ color: "#bfbfbf" }} />
                    )}
                  </div>
                  <div>
                    <Text strong>{product.name}</Text>
                    <div>
                      <Tag color={product.is_bundle ? "purple" : "blue"}>
                        {product.is_bundle ? "Paket" : product.category}
                      </Tag>
                    </div>
                  </div>
                </Space>
              );
            },
          },
          {
            title: "Barcode",
            dataIndex: "barcode",
            key: "barcode",
            render: (barcode) => barcode || "—",
          },
          {
            title: "Harga",
            dataIndex: "price",
            key: "price",
            render: (price) => <Text strong>{money(Number(price))}</Text>,
          },
          {
            title: "Stok",
            key: "stock",
            render: (_, product) =>
              product.is_bundle ? (
                <Tag color="default">Paket Bahan</Tag>
              ) : (
                <Tag color={product.stock <= 10 ? "error" : "success"}>
                  {product.stock} Unit
                </Tag>
              ),
          },
          {
            title: "Aksi",
            key: "action",
            render: (_, product) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => onEditProduct(product)}
                >
                  Edit
                </Button>
                {!product.is_bundle && (
                  <>
                    <Button
                      size="small"
                      onClick={() => onAdjustStock(product, -1)}
                    >
                      -1
                    </Button>
                    <Button
                      size="small"
                      onClick={() => onAdjustStock(product, 1)}
                    >
                      +1
                    </Button>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}

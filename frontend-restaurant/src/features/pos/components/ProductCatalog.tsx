import { Card, Col, Empty, Input, Radio, Row, Tag, Typography } from "antd";
import { InboxOutlined, SearchOutlined } from "@ant-design/icons";
import type { Product } from "../types";
import { money, photoHref } from "../utils";

const { Text } = Typography;

export type ProductCatalogProps = {
  products: Product[];
  categories: string[];
  query: string;
  category: string;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onScan: (barcode: string) => void;
  onAddToCart: (product: Product) => void;
};

export default function ProductCatalog({
  products,
  categories,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onScan,
  onAddToCart,
}: ProductCatalogProps) {
  return (
    <Card
      variant="borderless"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Input.Search
          placeholder="Cari nama menu atau scan barcode..."
          allowClear
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onSearch={onScan}
          style={{ maxWidth: 320 }}
          prefix={<SearchOutlined />}
        />
        <Radio.Group
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          buttonStyle="solid"
          size="small"
        >
          {categories.map((item) => (
            <Radio.Button key={item} value={item}>
              {item}
            </Radio.Button>
          ))}
        </Radio.Group>
      </div>

      {products.length === 0 ? (
        <Empty description="Tidak ada menu di outlet ini. Gunakan Tambah Menu untuk membuat menu baru." />
      ) : (
        <Row gutter={[12, 12]}>
          {products.map((product) => {
            const src = photoHref(product.photo_url);
            const isOutOfStock = !product.is_bundle && product.stock === 0;

            return (
              <Col xs={12} sm={8} md={8} xl={6} key={product.id}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => !isOutOfStock && onAddToCart(product)}
                  style={{
                    borderRadius: 8,
                    opacity: isOutOfStock ? 0.5 : 1,
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                  }}
                  cover={
                    <div
                      style={{
                        height: 110,
                        background: "#f5f5f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
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
                        <InboxOutlined
                          style={{ fontSize: 32, color: "#bfbfbf" }}
                        />
                      )}
                    </div>
                  }
                >
                  <div style={{ minHeight: 65 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        strong
                        ellipsis={{ tooltip: product.name }}
                        style={{ fontSize: 13 }}
                      >
                        {product.name}
                      </Text>
                      {product.is_bundle && (
                        <Tag color="purple" style={{ fontSize: 10 }}>
                          Paket
                        </Tag>
                      )}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {product.is_bundle
                          ? "Bundle Item"
                          : `Stok: ${product.stock}`}
                      </Text>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Text
                        strong
                        style={{ color: "#1677ff", fontSize: 14 }}
                      >
                        {money(product.price)}
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </Card>
  );
}

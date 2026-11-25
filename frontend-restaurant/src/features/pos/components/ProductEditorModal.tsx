import type { FormEvent } from "react";
import { Button, Checkbox, Col, Input, InputNumber, Modal, Row, Select, Space, Typography } from "antd";
import { BarcodeOutlined } from "@ant-design/icons";
import type { Product, ProductForm } from "../types";

const { Text } = Typography;

type ProductEditorModalProps = {
  open: boolean;
  editingProductId: number | null;
  form: ProductForm;
  products: Product[];
  photoPreview: string | null;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (form: ProductForm) => void;
  onPhotoChange: (file: File | null) => void;
};

export default function ProductEditorModal({
  open,
  editingProductId,
  form,
  products,
  photoPreview,
  onClose,
  onSave,
  onFormChange,
  onPhotoChange,
}: ProductEditorModalProps) {
  return (
    <Modal
      title={editingProductId ? "Edit Katalog Menu" : "Tambah Menu Baru"}
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <form onSubmit={onSave}>
        <Space
          orientation="vertical"
          size="middle"
          style={{ width: "100%", marginTop: 16 }}
        >
          <div>
            <Text strong>Nama Menu</Text>
            <Input
              placeholder="Contoh: Kopi Susu Aren"
              required
              value={form.name}
              onChange={(event) =>
                onFormChange({ ...form, name: event.target.value })
              }
              style={{ marginTop: 4 }}
            />
          </div>

          <Row gutter={8}>
            <Col span={12}>
              <Text strong>Kategori</Text>
              <Select
                value={form.category}
                onChange={(category) => onFormChange({ ...form, category })}
                style={{ width: "100%", marginTop: 4 }}
                options={[
                  { label: "Makanan", value: "Makanan" },
                  { label: "Minuman", value: "Minuman" },
                  { label: "Snack", value: "Snack" },
                  { label: "Paket", value: "Paket" },
                  { label: "Lainnya", value: "Lainnya" },
                ]}
              />
            </Col>
            <Col span={12}>
              <Text strong>Harga (Rp)</Text>
              <InputNumber
                min={0}
                required
                value={Number(form.price)}
                onChange={(value) =>
                  onFormChange({ ...form, price: String(value || 0) })
                }
                style={{ width: "100%", marginTop: 4 }}
                prefix="Rp"
              />
            </Col>
          </Row>

          <div>
            <Text strong>Barcode</Text>
            <Input
              placeholder="Pindai atau ketik barcode"
              value={form.barcode}
              onChange={(event) =>
                onFormChange({ ...form, barcode: event.target.value })
              }
              style={{ marginTop: 4 }}
              prefix={<BarcodeOutlined />}
            />
          </div>

          <Checkbox
            checked={form.is_bundle}
            onChange={(event) =>
              onFormChange({
                ...form,
                is_bundle: event.target.checked,
                category: event.target.checked ? "Paket" : "Makanan",
              })
            }
          >
            Menu ini merupakan Paket / Bundle
          </Checkbox>

          {form.is_bundle ? (
            <div>
              <Text strong>Pilih Komposisi Item Paket</Text>
              <Select
                mode="multiple"
                placeholder="Pilih item untuk paket"
                value={form.bundle_product_ids}
                onChange={(bundleProductIds) =>
                  onFormChange({ ...form, bundle_product_ids: bundleProductIds })
                }
                style={{ width: "100%", marginTop: 4 }}
                options={products
                  .filter(
                    (product) =>
                      !product.is_bundle && product.id !== editingProductId
                  )
                  .map((product) => ({
                    label: `${product.name} (Stok ${product.stock})`,
                    value: product.id,
                  }))}
              />
            </div>
          ) : (
            <div>
              <Text strong>
                {editingProductId ? "Stok Saat Ini" : "Stok Awal"}
              </Text>
              <InputNumber
                min={0}
                required
                value={Number(form.stock)}
                onChange={(value) =>
                  onFormChange({ ...form, stock: String(value || 0) })
                }
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          )}

          <div>
            <Text strong>Foto Menu</Text>
            <div style={{ marginTop: 6 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  onPhotoChange(event.target.files?.[0] || null)
                }
              />
            </div>
            {photoPreview && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={photoPreview}
                  alt="Preview"
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 8,
            }}
          >
            <Button onClick={onClose}>Batal</Button>
            <Button type="primary" htmlType="submit">
              {editingProductId ? "Simpan Perubahan" : "Simpan Menu"}
            </Button>
          </div>
        </Space>
      </form>
    </Modal>
  );
}

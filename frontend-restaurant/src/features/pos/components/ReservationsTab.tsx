import type { FormEvent } from "react";
import {
  Button,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type {
  Reservation,
  ReservationForm,
  ReservationSpace,
} from "../types";
import { localDate } from "../utils";

const { Text } = Typography;

export type ReservationsTabProps = {
  reservations: Reservation[];
  spaces: ReservationSpace[];
  availableSpaces: ReservationSpace[];
  reservationForm: ReservationForm;
  onReservationFormChange: (form: ReservationForm) => void;
  onCreateReservation: (event: FormEvent<HTMLFormElement>) => void;
};

const slots = ["11:00", "12:30", "14:00", "17:00", "18:00", "19:00", "20:30"];

export default function ReservationsTab({
  reservations,
  spaces,
  availableSpaces,
  reservationForm,
  onReservationFormChange,
  onCreateReservation,
}: ReservationsTabProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <Card
          variant="borderless"
          title="Jadwal Reservasi Meja"
          extra={
            <Space>
              <Text>Tanggal:</Text>
              <Input
                type="date"
                value={reservationForm.reservation_date}
                onChange={(event) =>
                  onReservationFormChange({
                    ...reservationForm,
                    reservation_date: event.target.value,
                  })
                }
                style={{ width: 160 }}
              />
            </Space>
          }
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <Table
            dataSource={reservations}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: "Jam Slot",
                key: "time",
                render: (_, reservation) => (
                  <Text strong>
                    {reservation.start_time.slice(0, 5)} -{" "}
                    {reservation.end_time.slice(0, 5)}
                  </Text>
                ),
              },
              {
                title: "Pemesan",
                dataIndex: "customer_name",
                key: "customer_name",
                render: (name) => <Text strong>{name}</Text>,
              },
              {
                title: "Meja",
                dataIndex: "space_name",
                key: "space_name",
              },
              {
                title: "Jumlah",
                dataIndex: "party_size",
                key: "party_size",
                render: (partySize) => `${partySize} orang`,
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                render: (status) => (
                  <Tag
                    color={
                      status === "confirmed"
                        ? "blue"
                        : status === "arrived"
                        ? "orange"
                        : status === "seated"
                        ? "green"
                        : "default"
                    }
                  >
                    {status}
                  </Tag>
                ),
              },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={9}>
        <Card
          variant="borderless"
          title="Buat Reservasi Baru"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
        >
          <form onSubmit={onCreateReservation}>
            <Space
              orientation="vertical"
              size="middle"
              style={{ width: "100%" }}
            >
              <div>
                <Text strong>Nama Pemesan</Text>
                <Input
                  placeholder="Nama pemesan"
                  required
                  value={reservationForm.customer_name}
                  onChange={(event) =>
                    onReservationFormChange({
                      ...reservationForm,
                      customer_name: event.target.value,
                    })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div>
                <Text strong>Tanggal Reservasi</Text>
                <Input
                  type="date"
                  min={localDate()}
                  required
                  value={reservationForm.reservation_date}
                  onChange={(event) =>
                    onReservationFormChange({
                      ...reservationForm,
                      reservation_date: event.target.value,
                    })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <Row gutter={8}>
                <Col span={12}>
                  <Text strong>Telepon</Text>
                  <Input
                    placeholder="08..."
                    value={reservationForm.phone}
                    onChange={(event) =>
                      onReservationFormChange({
                        ...reservationForm,
                        phone: event.target.value,
                      })
                    }
                    style={{ marginTop: 4 }}
                  />
                </Col>
                <Col span={12}>
                  <Text strong>Tamu</Text>
                  <InputNumber
                    min={1}
                    max={40}
                    value={Number(reservationForm.party_size)}
                    onChange={(value) => {
                      const partySize = String(value || 2);
                      const selectedSpace = spaces.find(
                        (space) =>
                          String(space.id) === reservationForm.space_id
                      );
                      const shouldResetSpace =
                        selectedSpace &&
                        selectedSpace.capacity < Number(partySize);
                      onReservationFormChange({
                        ...reservationForm,
                        party_size: partySize,
                        space_id: shouldResetSpace
                          ? ""
                          : reservationForm.space_id,
                      });
                    }}
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </Col>
              </Row>

              <div>
                <Text strong>Pilih Jam</Text>
                <Select
                  value={reservationForm.start_time}
                  onChange={(value) =>
                    onReservationFormChange({
                      ...reservationForm,
                      start_time: value,
                    })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  options={slots.map((slot) => ({
                    label: slot,
                    value: slot,
                  }))}
                />
              </div>

              <div>
                <Text strong>Pilih Meja Tersedia</Text>
                <Select
                  placeholder="Pilih meja"
                  value={reservationForm.space_id || undefined}
                  onChange={(value) =>
                    onReservationFormChange({
                      ...reservationForm,
                      space_id: value,
                    })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  options={availableSpaces.map((space) => ({
                    label: `${space.name} (Hingga ${space.capacity} orang)`,
                    value: String(space.id),
                  }))}
                />
              </div>

              <div>
                <Text strong>Catatan Khusus</Text>
                <Input.TextArea
                  placeholder="Permintaan khusus meja (opsional)"
                  value={reservationForm.notes}
                  onChange={(event) =>
                    onReservationFormChange({
                      ...reservationForm,
                      notes: event.target.value,
                    })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                disabled={!availableSpaces.length}
              >
                {availableSpaces.length
                  ? "Konfirmasi Reservasi"
                  : "Tidak Ada Meja Tersedia"}
              </Button>
            </Space>
          </form>
        </Card>
      </Col>
    </Row>
  );
}

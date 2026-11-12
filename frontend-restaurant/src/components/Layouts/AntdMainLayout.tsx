"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Typography, Space, Tag, theme } from "antd";
import {
  DashboardOutlined,
  ShopOutlined,
  CoffeeOutlined,
  CalendarOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

export default function AntdMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const selectedKey = pathname === "/pos" ? "/pos" : "/";

  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: <Link href="/">Denah & Antrean</Link>,
    },
    {
      key: "/pos",
      icon: <ShopOutlined />,
      label: <Link href="/pos">Kasir POS</Link>,
    },
  ];

  return (
    <Layout hasSider style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        width={240}
        style={{
          height: "100vh",
          position: "sticky",
          top: 0,
          left: 0,
          overflow: "auto",
          borderRight: "1px solid #f0f0f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 10,
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#1677ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            P
          </div>
          {!collapsed && (
            <div>
              <Title level={5} style={{ margin: 0, lineHeight: 1.2 }}>
                PADA Resto
              </Title>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Sistem Operasional
              </Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              {selectedKey === "/pos" ? "Point of Sale (Kasir)" : "Denah Meja & Manajemen Antrean"}
            </Title>
            <Tag color="processing">Sistem Aktif</Tag>
          </Space>

          <Space orientation="horizontal" size="middle">
            <Tag color="blue" icon={<ShopOutlined />}>
              Outlet Jakarta
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Versi Ant Design 5
            </Text>
          </Space>
        </Header>

        <Content
          style={{
            margin: "20px 24px",
            minHeight: "calc(100vh - 128px)",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}


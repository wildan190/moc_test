"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Typography, Space, Tag, theme, Grid, Button, Drawer } from "antd";
import {
  DashboardOutlined,
  ShopOutlined,
  CoffeeOutlined,
  CalendarOutlined,
  UserOutlined,
  MenuOutlined,
} from "@ant-design/icons";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

export default function AntdMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false;
  const isSmall = screens.xs === true;

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const selectedKey = pathname === "/pos" ? "/pos" : "/";

  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: <Link href="/" onClick={() => setMobileDrawerOpen(false)}>Denah & Antrean</Link>,
    },
    {
      key: "/pos",
      icon: <ShopOutlined />,
      label: <Link href="/pos" onClick={() => setMobileDrawerOpen(false)}>Kasir POS</Link>,
    },
  ];

  const brandHeader = (
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
      <div>
        <Title level={5} style={{ margin: 0, lineHeight: 1.2 }}>
          PADA Resto
        </Title>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Sistem Operasional
        </Text>
      </div>
    </div>
  );

  return (
    <Layout hasSider style={{ minHeight: "100vh" }}>
      {/* Desktop Sider: pinned sticky, doesn't scroll with page */}
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
          display: isMobile ? "none" : undefined,
        }}
      >
        {brandHeader}

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* Mobile Drawer Navigation */}
      <Drawer
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
        size={250}
      >
        {brandHeader}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Drawer>

      <Layout style={{ minWidth: 0, overflowX: "hidden" }}>
        <Header
          style={{
            padding: isSmall ? "0 12px" : "0 20px",
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
          <Space align="center" size={8} style={{ minWidth: 0, overflow: "hidden" }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
                style={{ fontSize: 18, padding: "4px 8px", marginRight: 4 }}
              />
            )}
            <Title
              level={4}
              style={{
                margin: 0,
                fontSize: isSmall ? 15 : 18,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {isSmall
                ? selectedKey === "/pos"
                  ? "Kasir POS"
                  : "Denah & Antrean"
                : selectedKey === "/pos"
                ? "Point of Sale (Kasir)"
                : "Denah Meja & Antrean"}
            </Title>
            {!isSmall && <Tag color="processing">Sistem Aktif</Tag>}
          </Space>

          <Space orientation="horizontal" size="small" style={{ flexShrink: 0 }}>
            <Tag color="blue" icon={<ShopOutlined />} style={{ margin: 0 }}>
              {isSmall ? "Jakarta" : "Outlet Jakarta"}
            </Tag>
            {!isMobile && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Versi Ant Design 5
              </Text>
            )}
          </Space>
        </Header>

        <Content
          style={{
            margin: isSmall ? "12px 10px" : "20px 24px",
            minHeight: "calc(100vh - 128px)",
            minWidth: 0,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}


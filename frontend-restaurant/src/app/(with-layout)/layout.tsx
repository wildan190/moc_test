import React from "react";
import AntdMainLayout from "@/components/Layouts/AntdMainLayout";

export default function WithLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AntdMainLayout>{children}</AntdMainLayout>;
}

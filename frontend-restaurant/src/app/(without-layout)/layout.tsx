import React from "react";

export default function WithoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f2f5",
        padding: "24px 16px",
      }}
    >
      {children}
    </div>
  );
}

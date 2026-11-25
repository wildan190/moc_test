const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/api";

export const photoHref = (url?: string | null) =>
  !url
    ? null
    : url.startsWith("http")
    ? url
    : `${API.replace(/\/api\/?$/, "")}${url.startsWith("/") ? url : `/${url}`}`;

export const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

export const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

export const endSlot = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + 90;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(isMultipart ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.message ||
        Object.values(body.errors || {})
          .flat()
          .join(" ") ||
        "Permintaan gagal."
    );
  return body as T;
}

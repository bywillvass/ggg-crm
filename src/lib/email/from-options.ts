export const FROM_ADDRESSES = [
  { value: "team@gingaglobalgroup.com",    label: "team@gingaglobalgroup.com",    name: "Ginga Global Group" },
  { value: "info@gingaglobalgroup.com",    label: "info@gingaglobalgroup.com",    name: "Ginga Global Group" },
  { value: "william@gingaglobalgroup.com", label: "william@gingaglobalgroup.com", name: "William" },
  { value: "theo@gingaglobalgroup.com",    label: "theo@gingaglobalgroup.com",    name: "Theo" },
] as const

export type FromAddress = typeof FROM_ADDRESSES[number]["value"]

export const DEFAULT_FROM: FromAddress = "team@gingaglobalgroup.com"

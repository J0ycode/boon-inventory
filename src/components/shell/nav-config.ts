import {
  Boxes,
  ChartColumn,
  ClipboardList,
  History,
  House,
  Inbox,
  LayoutDashboard,
  Package,
  PackagePlus,
  ReceiptIndianRupee,
  Settings,
  Tag,
  Truck,
  Undo2,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type Portal = "owner" | "storeroom" | "store";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** "exact" for portal home pages so they aren't highlighted on every child page. */
  match?: "exact" | "prefix";
};

/** Sidebar / icon-rail items per portal. Keep each list to 5–7 items. */
export const NAV: Record<Portal, NavItem[]> = {
  owner: [
    { href: "/owner", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
    { href: "/storeroom", label: "Store Room", icon: Warehouse },
    { href: "/owner/reports", label: "Reports", icon: ChartColumn },
    { href: "/owner/team", label: "Users & Locations", icon: Users },
    { href: "/owner/settings", label: "Settings", icon: Settings },
  ],
  storeroom: [
    { href: "/storeroom", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
    { href: "/storeroom/products", label: "Products", icon: Package },
    { href: "/storeroom/receive", label: "Receive Stock", icon: PackagePlus },
    { href: "/storeroom/dispatch", label: "Dispatch", icon: Truck },
    { href: "/storeroom/requests", label: "Restock Requests", icon: ClipboardList },
    { href: "/storeroom/returns", label: "Returns & Damaged", icon: Undo2 },
    { href: "/storeroom/reports", label: "Reports", icon: ChartColumn },
  ],
  store: [
    { href: "/store", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
    { href: "/store/stock", label: "My Stock", icon: Boxes },
    { href: "/store/incoming", label: "Incoming Dispatches", icon: Inbox },
    { href: "/store/requests", label: "Request Restock", icon: ClipboardList },
    { href: "/store/returns", label: "Return or Damaged", icon: Undo2 },
    { href: "/store/history", label: "Stock History", icon: History },
  ],
};

/** Secondary pages reachable from the phone "More" sheet (and from their parent screens on larger devices). */
export const MORE_EXTRA: Record<Portal, NavItem[]> = {
  owner: [],
  storeroom: [
    { href: "/storeroom/bills", label: "Purchase Bills", icon: ReceiptIndianRupee },
    { href: "/storeroom/labels", label: "Barcode Labels", icon: Tag },
    { href: "/storeroom/suppliers", label: "Suppliers", icon: Truck },
  ],
  store: [],
};

/** Phone bottom navigation: Home, Stock, [Scan], Requests, More. */
export const BOTTOM_NAV: Record<Portal, { home: NavItem; stock: NavItem; requests: NavItem }> = {
  owner: {
    home: { href: "/owner", label: "Home", icon: House, match: "exact" },
    stock: { href: "/storeroom/products", label: "Stock", icon: Boxes },
    requests: { href: "/storeroom/requests", label: "Requests", icon: ClipboardList },
  },
  storeroom: {
    home: { href: "/storeroom", label: "Home", icon: House, match: "exact" },
    stock: { href: "/storeroom/products", label: "Stock", icon: Boxes },
    requests: { href: "/storeroom/requests", label: "Requests", icon: ClipboardList },
  },
  store: {
    home: { href: "/store", label: "Home", icon: House, match: "exact" },
    stock: { href: "/store/stock", label: "Stock", icon: Boxes },
    requests: { href: "/store/requests", label: "Requests", icon: ClipboardList },
  },
};

export function isActive(item: NavItem, pathname: string): boolean {
  return item.match === "exact"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

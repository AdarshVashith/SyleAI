import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/home", label: "Home" },
  { to: "/wardrobe", label: "Wardrobe" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/me", label: "Me" }
];

function linkClass(active) {
  return [
    "rounded-xl px-4 py-2 text-sm font-semibold transition-all",
    active ? "bg-black text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
  ].join(" ");
}

export function TopTabNav() {
  return (
    <nav className="w-full rounded-2xl border border-gray-200 bg-white p-2">
      <ul className="grid grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink to={tab.to} className={({ isActive }) => linkClass(isActive)}>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BottomTabNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto grid w-full max-w-4xl grid-cols-4 gap-2 p-3">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink to={tab.to} className={({ isActive }) => linkClass(isActive)}>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const NAV_ITEMS = [
  { label: 'Pipeline', href: '/' },
  { label: 'QA Scores', href: '/qa' },
  { label: 'Publish History', href: '/publish' },
];

export function Sidebar() {
  return (
    <nav className="w-48 border-r border-gray-700 p-4">
      <ul className="space-y-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="block rounded px-3 py-2 text-sm hover:bg-gray-800"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface TabItem {
  id: string;
  label: string;
}

interface NavigationTabsProps {
  tabs: TabItem[];
  onTabChange: (tabId: string) => void;
  activeTab: string;
}

export function NavigationTabs({ tabs, onTabChange, activeTab }: NavigationTabsProps) {
  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <div className="bg-gray-50 border-b">
      <div className="container mx-auto px-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
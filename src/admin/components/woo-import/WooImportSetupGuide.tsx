import React, { useState } from 'react';
import {
  Server,
  Terminal,
  Database,
  Key,
  CheckCircle,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

const WooImportSetupGuide: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'running']));
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const CodeBlock: React.FC<{ code: string; label?: string }> = ({ code, label }) => (
    <div className="relative group">
      <pre className="bg-slate-900 rounded-lg p-4 text-sm text-slate-300 font-mono overflow-x-auto">
        {code}
      </pre>
      <button
        onClick={() => copyToClipboard(code, label || code)}
        className="absolute top-2 right-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copiedText === (label || code) ? (
          <CheckCircle size={14} className="text-emerald-400" />
        ) : (
          <Copy size={14} className="text-slate-300" />
        )}
      </button>
    </div>
  );

  const Section: React.FC<{
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ id, title, icon, children }) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="text-emerald-600">{icon}</span>
          <span className="flex-1 font-medium text-slate-800">{title}</span>
          {isExpanded ? (
            <ChevronDown size={20} className="text-slate-400" />
          ) : (
            <ChevronRight size={20} className="text-slate-400" />
          )}
        </button>
        {isExpanded && <div className="p-4 space-y-4">{children}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overview Section */}
      <Section id="overview" title="Architecture Overview" icon={<Server size={20} />}>
        <p className="text-slate-600 text-sm">
          The WooCommerce import runs as a Node.js CLI script on the IONOS server where the MySQL
          database lives. This approach is used because Supabase Edge Functions cannot directly
          connect to MySQL databases.
        </p>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <pre className="text-xs text-slate-600 font-mono whitespace-pre">
{`┌─────────────────┐     ┌───────────────────┐
│  Admin Panel    │     │  Import Service   │
│  (This Page)    │     │  (Node.js CLI)    │
└─────────────────┘     └────────┬──────────┘
        │                        │
        │  View logs             │  Run imports
        │                        ▼
        │               ┌─────────────────┐
        │               │  WooCommerce    │
        │               │  MySQL DB       │
        │               └────────┬────────┘
        │                        │
        └────────────────────────┼──────────────┐
                                 │              │
                                 ▼              ▼
                        ┌─────────────────────────────┐
                        │       Supabase              │
                        │  customers, legacy_orders,  │
                        │  woo_import_log             │
                        └─────────────────────────────┘`}
          </pre>
        </div>
      </Section>

      {/* Connection Details */}
      <Section id="connection" title="Server Connection Details" icon={<Key size={20} />}>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">SSH Access</h4>
            <CodeBlock code="ssh atlurbanfarms.com_rjv10m6w4t@great-banach" label="ssh" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">WooCommerce Database</h4>
            <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-2 font-medium text-slate-600 bg-slate-50">Host</td>
                    <td className="px-4 py-2 font-mono text-slate-800">localhost</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-slate-600 bg-slate-50">Database</td>
                    <td className="px-4 py-2 font-mono text-slate-800">dbs1763154</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-slate-600 bg-slate-50">User</td>
                    <td className="px-4 py-2 font-mono text-slate-800">dbu898109</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-slate-600 bg-slate-50">Table Prefix</td>
                    <td className="px-4 py-2 font-mono text-slate-800">PSnjqYbN</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Service Location</h4>
            <CodeBlock code="/var/www/vhosts/atlurbanfarms.com/woo-import-service/" label="path" />
            <p className="text-xs text-slate-500 mt-2">
              Or use shorthand: <code className="bg-slate-100 px-1 rounded">~/woo-import-service/</code>
            </p>
          </div>
        </div>
      </Section>

      {/* Initial Setup */}
      <Section id="setup" title="Initial Setup (One-Time)" icon={<Terminal size={20} />}>
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Before you start</p>
                <p className="mt-1">
                  You need the Supabase service role key. Get it from{' '}
                  <a
                    href="https://supabase.com/dashboard/project/povudgtvzggnxwgtjexa/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    Supabase Dashboard <ExternalLink size={12} />
                  </a>
                  {' '}→ Settings → API → service_role (secret)
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 1: Connect to Server</h4>
            <CodeBlock code="ssh atlurbanfarms.com_rjv10m6w4t@great-banach" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 2: Create Service Directory</h4>
            <CodeBlock code={`mkdir -p ~/woo-import-service\ncd ~/woo-import-service`} />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 3: Create package.json</h4>
            <CodeBlock
              code={`cat > package.json << 'EOF'
{
  "name": "woo-import-service",
  "version": "1.0.0",
  "main": "run-import.js",
  "dependencies": {
    "mysql2": "^3.6.0",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.39.0"
  }
}
EOF`}
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 4: Create .env file</h4>
            <CodeBlock
              code={`cat > .env << 'EOF'
# WooCommerce Database
WOO_DB_HOST=localhost
WOO_DB_NAME=dbs1763154
WOO_DB_USER=dbu898109
WOO_DB_PASSWORD=Database123!!
WOO_TABLE_PREFIX=PSnjqYbN

# Supabase
SUPABASE_URL=https://povudgtvzggnxwgtjexa.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
EOF`}
            />
            <p className="text-xs text-red-600 mt-2 font-medium">
              Replace your-service-role-key-here with the actual key from Supabase Dashboard!
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 5: Create run-import.js</h4>
            <p className="text-sm text-slate-600 mb-2">
              Copy the import script from the{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">woo-import-service/</code> folder in
              the repository, or download from the project.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 6: Install Dependencies</h4>
            <CodeBlock code="npm install" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Step 7: Test the Setup</h4>
            <CodeBlock code="node run-import.js stats" />
          </div>
        </div>
      </Section>

      {/* Running Imports */}
      <Section id="running" title="Running Imports" icon={<Database size={20} />}>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Check Current Status</h4>
            <CodeBlock code="node run-import.js stats" />
            <p className="text-xs text-slate-500 mt-2">
              Shows counts of customers and orders in both WooCommerce and Supabase
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Import Customers Since Date</h4>
            <CodeBlock code="node run-import.js customers 2026-01-15" />
            <p className="text-xs text-slate-500 mt-2">
              Imports customers who registered or were active since the given date
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Import Orders Since Date</h4>
            <CodeBlock code="node run-import.js orders 2026-01-15" />
            <p className="text-xs text-slate-500 mt-2">
              Imports completed orders since the given date
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Full Sync (All Data)</h4>
            <CodeBlock code="node run-import.js full" />
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} />
              Use sparingly - can take 10+ minutes for large datasets
            </p>
          </div>

          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <h4 className="text-sm font-semibold text-emerald-800 mb-2">Recommended Schedule</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-emerald-700">
                  <th className="pb-2">Frequency</th>
                  <th className="pb-2">What to Run</th>
                </tr>
              </thead>
              <tbody className="text-emerald-800">
                <tr>
                  <td className="py-1">Daily</td>
                  <td className="font-mono text-xs">orders [yesterday's date]</td>
                </tr>
                <tr>
                  <td className="py-1">Weekly</td>
                  <td className="font-mono text-xs">customers [7 days ago]</td>
                </tr>
                <tr>
                  <td className="py-1">Monthly</td>
                  <td className="font-mono text-xs">full</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Troubleshooting */}
      <Section id="troubleshooting" title="Troubleshooting" icon={<AlertTriangle size={20} />}>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">"Connection refused" error</h4>
            <p className="text-sm text-slate-600 mb-2">MySQL might not be running. Test with:</p>
            <CodeBlock code={`mysql -u dbu898109 -p'Database123!!' dbs1763154 -e "SELECT 1"`} />
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">"Invalid API key" error</h4>
            <p className="text-sm text-slate-600">
              Verify the Supabase service key in <code className="bg-slate-200 px-1 rounded">.env</code>.
              Get the correct key from Supabase Dashboard → Settings → API → service_role
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">"Duplicate key" errors</h4>
            <p className="text-sm text-slate-600">
              These are normal! It means the order was already imported. The script automatically
              skips duplicates.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Check WooCommerce data directly</h4>
            <CodeBlock
              code={`mysql -u dbu898109 -p'Database123!!' dbs1763154

# Count customers
SELECT COUNT(*) FROM PSnjqYbNwc_customer_lookup;

# Count completed orders
SELECT COUNT(*) FROM PSnjqYbNwc_order_stats WHERE status = 'wc-completed';

# Recent orders
SELECT order_id, date_created, total_sales
FROM PSnjqYbNwc_order_stats
WHERE status = 'wc-completed'
ORDER BY date_created DESC
LIMIT 10;`}
            />
          </div>
        </div>
      </Section>

      {/* Data Reference */}
      <Section id="reference" title="Data Reference" icon={<Database size={20} />}>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">WooCommerce Tables Used</h4>
            <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Table</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">PSnjqYbNwc_customer_lookup</td>
                    <td className="px-4 py-2 text-slate-600">Customer data</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">PSnjqYbNwc_order_stats</td>
                    <td className="px-4 py-2 text-slate-600">Order summaries</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Supabase Tables</h4>
            <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Table</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">customers</td>
                    <td className="px-4 py-2 text-slate-600">
                      Customer records (with <code className="bg-slate-200 px-1 rounded">woo_customer_id</code>)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">legacy_orders</td>
                    <td className="px-4 py-2 text-slate-600">Historical orders from WooCommerce</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">woo_import_log</td>
                    <td className="px-4 py-2 text-slate-600">Import history (shown in History tab)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Customer Matching Logic</h4>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
              <li>Check if email exists in Supabase customers</li>
              <li>If exists and no woo_customer_id, update with WooCommerce ID</li>
              <li>If not exists, create new customer record</li>
            </ol>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Order Import Logic</h4>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
              <li>Check if woo_order_id exists in legacy_orders</li>
              <li>If exists, skip (already imported)</li>
              <li>If not, look up customer_id by woo_customer_id</li>
              <li>Insert new legacy order</li>
            </ol>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default WooImportSetupGuide;

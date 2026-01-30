/**
 * WooCommerce Import Service
 *
 * Imports customers and orders from WooCommerce MySQL database to Supabase.
 * Run this script on the server where the MySQL database is located.
 *
 * Usage:
 *   node run-import.js stats                    - Show current counts
 *   node run-import.js customers [since-date]   - Import customers
 *   node run-import.js orders [since-date]      - Import orders
 *   node run-import.js full                     - Full sync (all data)
 *
 * Examples:
 *   node run-import.js stats
 *   node run-import.js customers 2026-01-01
 *   node run-import.js orders 2026-01-15
 *   node run-import.js full
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

// Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// WooCommerce table prefix
const PREFIX = process.env.WOO_TABLE_PREFIX;

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.WOO_DB_HOST,
  user: process.env.WOO_DB_USER,
  password: process.env.WOO_DB_PASSWORD,
  database: process.env.WOO_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ============================================
// IMPORT FUNCTIONS
// ============================================

/**
 * Import customers from WooCommerce
 */
async function importCustomers(since = null) {
  console.log('\n📥 Starting customer import...');
  const stats = { imported: 0, updated: 0, skipped: 0, errors: [] };

  try {
    // Build query
    let query = `
      SELECT
        customer_id as woo_customer_id,
        email,
        first_name,
        last_name,
        date_registered
      FROM ${PREFIX}wc_customer_lookup
    `;

    if (since) {
      query += ` WHERE date_last_active > '${since}' OR date_registered > '${since}'`;
    }

    const [customers] = await pool.query(query);
    console.log(`   Found ${customers.length} customers to process`);

    for (const cust of customers) {
      try {
        // Skip if no email
        if (!cust.email) {
          stats.skipped++;
          continue;
        }

        const email = cust.email.toLowerCase().trim();

        // Check if customer exists by email
        const { data: existing } = await supabase
          .from('customers')
          .select('id, woo_customer_id')
          .eq('email', email)
          .single();

        if (existing) {
          // Update woo_customer_id if not set
          if (!existing.woo_customer_id) {
            await supabase
              .from('customers')
              .update({ woo_customer_id: cust.woo_customer_id })
              .eq('id', existing.id);
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          // Insert new customer
          const { error: insertError } = await supabase.from('customers').insert({
            email: email,
            first_name: cust.first_name || null,
            last_name: cust.last_name || null,
            woo_customer_id: cust.woo_customer_id,
            created_at: cust.date_registered || new Date().toISOString(),
            role: 'customer'
          });

          if (insertError) {
            // Handle unique constraint violation (duplicate email)
            if (insertError.code === '23505') {
              stats.skipped++;
            } else {
              throw insertError;
            }
          } else {
            stats.imported++;
          }
        }

        // Progress indicator
        const total = stats.imported + stats.updated + stats.skipped;
        if (total % 100 === 0) {
          console.log(`   Progress: ${total}/${customers.length} (${stats.imported} new, ${stats.updated} updated)`);
        }
      } catch (err) {
        stats.errors.push({ email: cust.email, error: err.message });
      }
    }

    console.log(`\n✅ Customer Import Complete:`);
    console.log(`   Imported: ${stats.imported}`);
    console.log(`   Updated: ${stats.updated}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0 && stats.errors.length <= 5) {
      console.log('\n   First few errors:');
      stats.errors.slice(0, 5).forEach(e => console.log(`   - ${e.email}: ${e.error}`));
    }

    return stats;
  } catch (err) {
    console.error('❌ Customer import failed:', err.message);
    stats.errors.push({ error: err.message });
    return stats;
  }
}

/**
 * Import orders from WooCommerce
 */
async function importOrders(since = null) {
  console.log('\n📥 Starting order import...');
  const stats = { imported: 0, skipped: 0, errors: [] };

  try {
    // Build query for completed orders
    let query = `
      SELECT
        o.order_id as woo_order_id,
        o.customer_id as woo_customer_id,
        o.date_created as order_date,
        o.status,
        o.total_sales as total,
        o.tax_total as tax,
        o.shipping_total as shipping,
        o.net_total as subtotal
      FROM ${PREFIX}wc_order_stats o
      WHERE o.status = 'wc-completed'
    `;

    if (since) {
      query += ` AND o.date_created > '${since}'`;
    }

    query += ' ORDER BY o.order_id';

    const [orders] = await pool.query(query);
    console.log(`   Found ${orders.length} orders to process`);

    for (const order of orders) {
      try {
        // Check if order already exists
        const { data: existing } = await supabase
          .from('legacy_orders')
          .select('id')
          .eq('woo_order_id', order.woo_order_id)
          .single();

        if (existing) {
          stats.skipped++;
          continue;
        }

        // Find Supabase customer_id by woo_customer_id
        let customerId = null;
        if (order.woo_customer_id && order.woo_customer_id > 0) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('woo_customer_id', order.woo_customer_id)
            .single();
          customerId = customer?.id || null;
        }

        // Insert legacy order
        const { error: insertError } = await supabase.from('legacy_orders').insert({
          woo_order_id: order.woo_order_id,
          customer_id: customerId,
          woo_customer_id: order.woo_customer_id || null,
          order_date: order.order_date,
          status: order.status.replace('wc-', ''),
          subtotal: order.subtotal || 0,
          tax: order.tax || 0,
          shipping: order.shipping || 0,
          total: order.total || 0
        });

        if (insertError) {
          // Handle unique constraint violation (duplicate order)
          if (insertError.code === '23505') {
            stats.skipped++;
          } else {
            throw insertError;
          }
        } else {
          stats.imported++;
        }

        // Progress indicator
        const total = stats.imported + stats.skipped;
        if (total % 100 === 0) {
          console.log(`   Progress: ${total}/${orders.length} (${stats.imported} new, ${stats.skipped} skipped)`);
        }
      } catch (err) {
        if (!err.message.includes('duplicate')) {
          stats.errors.push({ order_id: order.woo_order_id, error: err.message });
        } else {
          stats.skipped++;
        }
      }
    }

    console.log(`\n✅ Order Import Complete:`);
    console.log(`   Imported: ${stats.imported}`);
    console.log(`   Skipped (already exists): ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0 && stats.errors.length <= 5) {
      console.log('\n   First few errors:');
      stats.errors.slice(0, 5).forEach(e => console.log(`   - Order ${e.order_id}: ${e.error}`));
    }

    return stats;
  } catch (err) {
    console.error('❌ Order import failed:', err.message);
    stats.errors.push({ error: err.message });
    return stats;
  }
}

/**
 * Show current stats
 */
async function showStats() {
  console.log('\n📊 Fetching statistics...\n');

  try {
    // WooCommerce counts
    const [wooCustomers] = await pool.query(
      `SELECT COUNT(*) as count FROM ${PREFIX}wc_customer_lookup`
    );
    const [wooOrders] = await pool.query(
      `SELECT COUNT(*) as count FROM ${PREFIX}wc_order_stats WHERE status = 'wc-completed'`
    );

    // Supabase counts
    const { count: sbCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: sbCustomersWithWoo } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .not('woo_customer_id', 'is', null);

    const { count: sbOrders } = await supabase
      .from('legacy_orders')
      .select('*', { count: 'exact', head: true });

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║          WooCommerce Import Statistics            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  WooCommerce Customers:  ${String(wooCustomers[0].count).padStart(8)}              ║`);
    console.log(`║  WooCommerce Orders:     ${String(wooOrders[0].count).padStart(8)}              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Supabase Customers:     ${String(sbCustomers || 0).padStart(8)}              ║`);
    console.log(`║    (with WooCommerce ID) ${String(sbCustomersWithWoo || 0).padStart(8)}              ║`);
    console.log(`║  Supabase Legacy Orders: ${String(sbOrders || 0).padStart(8)}              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Customers to sync:      ${String(wooCustomers[0].count - (sbCustomersWithWoo || 0)).padStart(8)}              ║`);
    console.log(`║  Orders to sync:         ${String(wooOrders[0].count - (sbOrders || 0)).padStart(8)}              ║`);
    console.log('╚══════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('❌ Error fetching stats:', err.message);
  }
}

/**
 * Log import to Supabase
 */
async function logImport(type, customerStats, orderStats) {
  try {
    await supabase.from('woo_import_log').insert({
      import_type: type,
      status: 'completed',
      completed_at: new Date().toISOString(),
      customers_imported: customerStats?.imported || 0,
      customers_updated: customerStats?.updated || 0,
      orders_imported: orderStats?.imported || 0,
      orders_skipped: orderStats?.skipped || 0,
      errors: [
        ...(customerStats?.errors || []),
        ...(orderStats?.errors || [])
      ].slice(0, 50) // Limit errors stored
    });
    console.log('\n📝 Import logged to database');
  } catch (err) {
    console.error('⚠️  Failed to log import:', err.message);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const command = process.argv[2] || 'help';
  const since = process.argv[3] || null;

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        WooCommerce Import Tool v1.0              ║');
  console.log('║        ATL Urban Farms                           ║');
  console.log('╚══════════════════════════════════════════════════╝');

  let customerStats = null;
  let orderStats = null;

  switch (command) {
    case 'customers':
      console.log(since ? `\n🗓️  Importing customers since ${since}` : '\n🗓️  Importing ALL customers');
      customerStats = await importCustomers(since);
      await logImport('customers', customerStats, null);
      break;

    case 'orders':
      console.log(since ? `\n🗓️  Importing orders since ${since}` : '\n🗓️  Importing ALL orders');
      orderStats = await importOrders(since);
      await logImport('orders', null, orderStats);
      break;

    case 'full':
      console.log('\n🔄 Running FULL sync (customers + orders)');
      console.log('   This may take several minutes...');
      customerStats = await importCustomers();
      orderStats = await importOrders();
      await logImport('full', customerStats, orderStats);
      break;

    case 'stats':
      await showStats();
      break;

    default:
      console.log(`
Usage:
  node run-import.js stats                    - Show current counts
  node run-import.js customers [since-date]   - Import customers
  node run-import.js orders [since-date]      - Import orders
  node run-import.js full                     - Full sync

Examples:
  node run-import.js stats
  node run-import.js customers 2026-01-01
  node run-import.js orders 2026-01-15
  node run-import.js full
`);
  }

  await pool.end();
  console.log('\n👋 Done!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

/**
 * WooCommerce Import Service
 *
 * Imports customers, orders, and line items from WooCommerce MySQL database to Supabase.
 * Run this script on the server where the MySQL database is located.
 *
 * Usage:
 *   node run-import.js stats                              - Show current counts
 *   node run-import.js customers [since-date]             - Import customers
 *   node run-import.js orders [since-date] [until-date]   - Import orders (completed + processing)
 *   node run-import.js lineitems                          - Import line items for existing orders
 *   node run-import.js full                               - Full sync (all data)
 *
 * Examples:
 *   node run-import.js stats
 *   node run-import.js customers 2026-01-01
 *   node run-import.js orders 2026-02-03 2026-03-04       - Import orders in date range
 *   node run-import.js orders 2026-01-15
 *   node run-import.js lineitems
 *   node run-import.js full
 *
 * Notes:
 *   - Orders imports both 'wc-completed' and 'wc-processing' statuses
 *   - Billing/shipping addresses are imported from WooCommerce post meta
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
 * Fetch billing/shipping address from WooCommerce post meta
 */
async function fetchOrderAddresses(wooOrderId) {
  try {
    const [rows] = await pool.query(
      `SELECT meta_key, meta_value
       FROM ${PREFIX}postmeta
       WHERE post_id = ?
         AND meta_key IN (
           '_billing_email', '_billing_first_name', '_billing_last_name',
           '_billing_address_1', '_billing_city', '_billing_state', '_billing_postcode',
           '_shipping_first_name', '_shipping_last_name',
           '_shipping_address_1', '_shipping_city', '_shipping_state', '_shipping_postcode',
           '_payment_method'
         )`,
      [wooOrderId]
    );

    const meta = {};
    for (const row of rows) {
      meta[row.meta_key] = row.meta_value;
    }

    return {
      billing_email: meta['_billing_email'] || null,
      billing_first_name: meta['_billing_first_name'] || null,
      billing_last_name: meta['_billing_last_name'] || null,
      billing_address: meta['_billing_address_1'] || null,
      billing_city: meta['_billing_city'] || null,
      billing_state: meta['_billing_state'] || null,
      billing_zip: meta['_billing_postcode'] || null,
      shipping_first_name: meta['_shipping_first_name'] || null,
      shipping_last_name: meta['_shipping_last_name'] || null,
      shipping_address: meta['_shipping_address_1'] || null,
      shipping_city: meta['_shipping_city'] || null,
      shipping_state: meta['_shipping_state'] || null,
      shipping_zip: meta['_shipping_postcode'] || null,
      payment_method: meta['_payment_method'] || null,
    };
  } catch {
    return {};
  }
}

/**
 * Import orders from WooCommerce
 * Imports both wc-completed and wc-processing orders
 */
async function importOrders(since = null, until = null) {
  console.log('\n📥 Starting order import...');
  const stats = { imported: 0, skipped: 0, errors: [] };

  // Import completed and processing orders (processing = paid, awaiting fulfillment)
  const IMPORT_STATUSES = ['wc-completed', 'wc-processing'];

  try {
    // Build query for completed + processing orders
    const statusPlaceholders = IMPORT_STATUSES.map(() => '?').join(', ');
    const queryParams = [...IMPORT_STATUSES];

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
      WHERE o.status IN (${statusPlaceholders})
    `;

    if (since) {
      query += ` AND o.date_created >= ?`;
      queryParams.push(since);
    }

    if (until) {
      query += ` AND o.date_created <= ?`;
      queryParams.push(until + ' 23:59:59');
    }

    query += ' ORDER BY o.order_id';

    const [orders] = await pool.query(query, queryParams);
    console.log(`   Found ${orders.length} orders to process (statuses: ${IMPORT_STATUSES.join(', ')})`);
    if (since || until) {
      console.log(`   Date range: ${since || 'beginning'} to ${until || 'now'}`);
    }

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

        // Fetch billing/shipping addresses from post meta
        const addresses = await fetchOrderAddresses(order.woo_order_id);

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
          total: order.total || 0,
          ...addresses,
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
 * Import line items from WooCommerce orders
 */
async function importLineItems() {
  console.log('\n📥 Starting line items import...');
  const stats = { imported: 0, skipped: 0, noOrder: 0, errors: [] };

  try {
    // Query for all line items from completed orders
    const query = `
      SELECT
        oi.order_id as woo_order_id,
        oi.order_item_name as product_name,
        CAST(MAX(CASE WHEN oim.meta_key = '_qty' THEN oim.meta_value END) AS UNSIGNED) as quantity,
        ROUND(MAX(CASE WHEN oim.meta_key = '_line_total' THEN oim.meta_value END), 2) as line_total,
        CAST(MAX(CASE WHEN oim.meta_key = '_product_id' THEN oim.meta_value END) AS UNSIGNED) as woo_product_id
      FROM ${PREFIX}woocommerce_order_items oi
      JOIN ${PREFIX}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
      JOIN ${PREFIX}wc_order_stats os ON oi.order_id = os.order_id
      WHERE oi.order_item_type = 'line_item'
        AND os.status IN ('wc-completed', 'wc-processing')
      GROUP BY oi.order_item_id, oi.order_id, oi.order_item_name
      ORDER BY oi.order_id
    `;

    const [items] = await pool.query(query);
    console.log(`   Found ${items.length} line items in WooCommerce`);

    // Cache lookups for performance
    const orderCache = new Map();
    const productCache = new Map();

    for (const item of items) {
      try {
        // Look up legacy_order_id (with cache)
        let legacyOrderId = orderCache.get(item.woo_order_id);
        if (legacyOrderId === undefined) {
          const { data: order } = await supabase
            .from('legacy_orders')
            .select('id')
            .eq('woo_order_id', item.woo_order_id)
            .single();

          legacyOrderId = order?.id || null;
          orderCache.set(item.woo_order_id, legacyOrderId);
        }

        if (!legacyOrderId) {
          stats.noOrder++;
          continue;
        }

        // Look up product_id by woo_id (with cache)
        let productId = productCache.get(item.woo_product_id);
        if (productId === undefined && item.woo_product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('woo_id', item.woo_product_id)
            .single();

          productId = product?.id || null;
          productCache.set(item.woo_product_id, productId);
        }

        // Insert line item
        const { error: insertError } = await supabase.from('legacy_order_items').insert({
          legacy_order_id: legacyOrderId,
          woo_order_id: item.woo_order_id,
          woo_product_id: item.woo_product_id || null,
          product_id: productId || null,
          product_name: item.product_name,
          quantity: item.quantity || 1,
          line_total: item.line_total || 0
        });

        if (insertError) {
          if (insertError.message.includes('duplicate') || insertError.code === '23505') {
            stats.skipped++;
          } else {
            stats.errors.push({ woo_order_id: item.woo_order_id, error: insertError.message });
          }
        } else {
          stats.imported++;
        }

        // Progress indicator
        const total = stats.imported + stats.skipped + stats.noOrder;
        if (total % 500 === 0) {
          console.log(`   Progress: ${total}/${items.length} (${stats.imported} new, ${stats.skipped} skipped, ${stats.noOrder} no order)`);
        }
      } catch (err) {
        stats.errors.push({ woo_order_id: item.woo_order_id, error: err.message });
      }
    }

    console.log(`\n✅ Line Items Import Complete:`);
    console.log(`   Imported: ${stats.imported}`);
    console.log(`   Skipped (duplicate): ${stats.skipped}`);
    console.log(`   No matching order: ${stats.noOrder}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0 && stats.errors.length <= 5) {
      console.log('\n   First few errors:');
      stats.errors.slice(0, 5).forEach(e => console.log(`   - Order ${e.woo_order_id}: ${e.error}`));
    }

    return stats;
  } catch (err) {
    console.error('❌ Line items import failed:', err.message);
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
      `SELECT COUNT(*) as count FROM ${PREFIX}wc_order_stats WHERE status IN ('wc-completed', 'wc-processing')`
    );
    const [wooLineItems] = await pool.query(
      `SELECT COUNT(DISTINCT oi.order_item_id) as count
       FROM ${PREFIX}woocommerce_order_items oi
       JOIN ${PREFIX}wc_order_stats os ON oi.order_id = os.order_id
       WHERE oi.order_item_type = 'line_item' AND os.status IN ('wc-completed', 'wc-processing')`
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

    const { count: sbLineItems } = await supabase
      .from('legacy_order_items')
      .select('*', { count: 'exact', head: true });

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║          WooCommerce Import Statistics            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  WooCommerce Customers:  ${String(wooCustomers[0].count).padStart(8)}              ║`);
    console.log(`║  WooCommerce Orders:     ${String(wooOrders[0].count).padStart(8)}              ║`);
    console.log(`║  WooCommerce Line Items: ${String(wooLineItems[0].count).padStart(8)}              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Supabase Customers:     ${String(sbCustomers || 0).padStart(8)}              ║`);
    console.log(`║    (with WooCommerce ID) ${String(sbCustomersWithWoo || 0).padStart(8)}              ║`);
    console.log(`║  Supabase Legacy Orders: ${String(sbOrders || 0).padStart(8)}              ║`);
    console.log(`║  Supabase Line Items:    ${String(sbLineItems || 0).padStart(8)}              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Customers to sync:      ${String(wooCustomers[0].count - (sbCustomersWithWoo || 0)).padStart(8)}              ║`);
    console.log(`║  Orders to sync:         ${String(wooOrders[0].count - (sbOrders || 0)).padStart(8)}              ║`);
    console.log(`║  Line items to sync:     ${String(wooLineItems[0].count - (sbLineItems || 0)).padStart(8)}              ║`);
    console.log('╚══════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('❌ Error fetching stats:', err.message);
  }
}

/**
 * Log import to Supabase
 */
async function logImport(type, customerStats, orderStats, lineItemStats) {
  try {
    await supabase.from('woo_import_log').insert({
      import_type: type,
      status: 'completed',
      completed_at: new Date().toISOString(),
      customers_imported: customerStats?.imported || 0,
      customers_updated: customerStats?.updated || 0,
      orders_imported: orderStats?.imported || 0,
      orders_skipped: orderStats?.skipped || 0,
      line_items_imported: lineItemStats?.imported || 0,
      errors: [
        ...(customerStats?.errors || []),
        ...(orderStats?.errors || []),
        ...(lineItemStats?.errors || [])
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
  const until = process.argv[4] || null;

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        WooCommerce Import Tool v1.1              ║');
  console.log('║        ATL Urban Farms                           ║');
  console.log('╚══════════════════════════════════════════════════╝');

  let customerStats = null;
  let orderStats = null;
  let lineItemStats = null;

  switch (command) {
    case 'customers':
      console.log(since ? `\n🗓️  Importing customers since ${since}` : '\n🗓️  Importing ALL customers');
      customerStats = await importCustomers(since);
      await logImport('customers', customerStats, null, null);
      break;

    case 'orders':
      if (since && until) {
        console.log(`\n🗓️  Importing orders from ${since} to ${until}`);
      } else if (since) {
        console.log(`\n🗓️  Importing orders since ${since}`);
      } else {
        console.log('\n🗓️  Importing ALL orders');
      }
      orderStats = await importOrders(since, until);
      await logImport('orders', null, orderStats, null);
      break;

    case 'lineitems':
      console.log('\n📦 Importing line items for all imported orders...');
      lineItemStats = await importLineItems();
      await logImport('line_items', null, null, lineItemStats);
      break;

    case 'full':
      console.log('\n🔄 Running FULL sync (customers + orders + line items)');
      console.log('   This may take several minutes...');
      customerStats = await importCustomers();
      orderStats = await importOrders();
      lineItemStats = await importLineItems();
      await logImport('full', customerStats, orderStats, lineItemStats);
      break;

    case 'stats':
      await showStats();
      break;

    default:
      console.log(`
Usage:
  node run-import.js stats                              - Show current counts
  node run-import.js customers [since-date]             - Import customers
  node run-import.js orders [since-date] [until-date]   - Import orders (completed + processing)
  node run-import.js lineitems                          - Import line items for existing orders
  node run-import.js full                               - Full sync (customers + orders + line items)

Examples:
  node run-import.js stats
  node run-import.js customers 2026-01-01
  node run-import.js orders 2026-02-03 2026-03-04       - Import orders in date range
  node run-import.js orders 2026-01-15                  - Import orders since date
  node run-import.js lineitems
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

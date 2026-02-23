import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Authentication hook - manages user session state
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  return { user, session, loading, signOut }
}

/**
 * Fetch customer profile data from customers table
 */
export function useCustomerProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchProfile() {
      try {
        setLoading(true)
        setError(null)

        // Fetch customer data and profile data in parallel
        const [customerResult, profileResult] = await Promise.all([
          supabase
            .from('customers')
            .select('*')
            .eq('id', userId)
            .single(),
          supabase
            .from('customer_profiles')
            .select('*')
            .eq('customer_id', userId)
            .maybeSingle()
        ])

        if (customerResult.error && customerResult.error.code !== 'PGRST116') {
          throw customerResult.error
        }

        // Merge customer data with profile data
        const mergedProfile = {
          ...customerResult.data,
          // Profile fields from customer_profiles table (may not exist)
          growing_environment: profileResult.data?.growing_environment || null,
          experience_level: profileResult.data?.experience_level || null,
          growing_systems: profileResult.data?.growing_systems || [],
          growing_interests: profileResult.data?.growing_interests || []
        }

        setProfile(mergedProfile)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [userId])

  const updateProfile = useCallback(async (updates) => {
    if (!userId) return { error: 'No user ID' }

    try {
      // Update core customer fields in customers table
      const customerFields = {
        id: userId,
        first_name: updates.first_name,
        last_name: updates.last_name,
        phone: updates.phone,
        company: updates.company || null,
        newsletter_subscribed: updates.newsletter_subscribed,
        sms_opt_in: updates.sms_opt_in,
        updated_at: new Date().toISOString()
      }

      // Include email if provided (required for upsert when customer row doesn't exist yet)
      if (updates.email) {
        customerFields.email = updates.email
      }

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .upsert(customerFields)
        .select()
        .single()

      if (customerError) throw customerError

      // Update profile fields in customer_profiles table (separate table)
      const hasProfileFields = updates.growing_environment !== undefined ||
        updates.experience_level !== undefined ||
        updates.growing_systems !== undefined ||
        updates.growing_interests !== undefined

      if (hasProfileFields) {
        const profileFields = {
          customer_id: userId,
          growing_environment: updates.growing_environment || null,
          experience_level: updates.experience_level || null,
          growing_systems: updates.growing_systems?.length > 0 ? updates.growing_systems : null,
          growing_interests: updates.growing_interests?.length > 0 ? updates.growing_interests : null,
          updated_at: new Date().toISOString()
        }

        const { error: profileError } = await supabase
          .from('customer_profiles')
          .upsert(profileFields, { onConflict: 'customer_id' })

        if (profileError) {
          console.error('Error updating customer profile:', profileError)
          // Don't fail the whole update if profile update fails
        }
      }

      // Merge customer data with profile fields for local state
      const mergedData = {
        ...customerData,
        growing_environment: updates.growing_environment,
        experience_level: updates.experience_level,
        growing_systems: updates.growing_systems,
        growing_interests: updates.growing_interests
      }

      setProfile(mergedData)
      return { data: mergedData }
    } catch (err) {
      return { error: err.message }
    }
  }, [userId])

  return { profile, loading, error, updateProfile }
}

/**
 * Fetch customer orders
 */
export function useOrders(customerId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    async function fetchOrders() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items:order_items(
              *,
              product:products(name, slug, images:product_images(url, is_primary, sort_order))
            ),
            shipments:shipments(
              id,
              tracking_number,
              carrier_code,
              status,
              tracking_status,
              estimated_delivery_date,
              actual_delivery_date
            )
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })

        if (supabaseError) throw supabaseError
        // Flatten product images to a single primary_image_url for convenience
        const processed = (data || []).map(order => ({
          ...order,
          order_items: order.order_items?.map(item => ({
            ...item,
            product: item.product ? {
              name: item.product.name,
              slug: item.product.slug,
              primary_image_url: item.product.images?.find(img => img.is_primary)?.url
                || item.product.images?.[0]?.url
                || null
            } : null
          }))
        }))
        setOrders(processed)
      } catch (err) {
        setError(err.message)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [customerId])

  return { orders, loading, error }
}

/**
 * Fetch legacy orders (imported from WooCommerce)
 */
export function useLegacyOrders(customerId) {
  const [legacyOrders, setLegacyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    async function fetchLegacyOrders() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('legacy_orders')
          .select('*')
          .eq('customer_id', customerId)
          .order('order_date', { ascending: false })

        if (supabaseError) throw supabaseError
        setLegacyOrders(data || [])
      } catch (err) {
        // If table doesn't exist yet, just return empty array
        if (err.code === '42P01') {
          setLegacyOrders([])
        } else {
          setError(err.message)
          setLegacyOrders([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchLegacyOrders()
  }, [customerId])

  return { legacyOrders, loading, error }
}

/**
 * Fetch legacy order items for a specific legacy order
 * Includes linked product data when available
 */
export function useLegacyOrderItems(legacyOrderId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!legacyOrderId) {
      setItems([])
      setLoading(false)
      return
    }

    async function fetchItems() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('legacy_order_items')
          .select(`
            *,
            product:products(
              id,
              name,
              slug,
              images:product_images(id, url, is_primary, sort_order)
            )
          `)
          .eq('legacy_order_id', legacyOrderId)
          .order('product_name')

        if (supabaseError) throw supabaseError
        setItems(data || [])
      } catch (err) {
        // If table doesn't exist yet, just return empty array
        if (err.code === '42P01') {
          setItems([])
        } else {
          setError(err.message)
          setItems([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [legacyOrderId])

  return { items, loading, error }
}

/**
 * Fetch combined orders (new orders + legacy orders from WooCommerce)
 * Returns a unified list sorted by date with isLegacy flag
 */
export function useCombinedOrders(customerId) {
  const [combinedOrders, setCombinedOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    async function fetchAllOrders() {
      try {
        setLoading(true)
        setError(null)

        // Fetch new orders with related data
        const newOrdersResult = await supabase
          .from('orders')
          .select(`
            *,
            order_items:order_items(
              *,
              product:products(name, slug, images:product_images(url, is_primary, sort_order))
            ),
            shipments:shipments(
              id,
              tracking_number,
              carrier_code,
              status,
              tracking_status,
              estimated_delivery_date,
              actual_delivery_date
            )
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })

        if (newOrdersResult.error) {
          console.error('Error fetching orders with items:', newOrdersResult.error)
          throw newOrdersResult.error
        }

        const newOrders = (newOrdersResult.data || []).map(order => ({
          ...order,
          isLegacy: false,
          orderDate: order.created_at,
          order_items: order.order_items?.map(item => ({
            ...item,
            product: item.product ? {
              name: item.product.name,
              slug: item.product.slug,
              primary_image_url: item.product.images?.find(img => img.is_primary)?.url
                || item.product.images?.[0]?.url
                || null
            } : null
          }))
        }))

        // Fetch legacy orders separately - don't let this fail the whole request
        let legacyOrders = []
        try {
          const legacyOrdersResult = await supabase
            .from('legacy_orders')
            .select('*')
            .eq('customer_id', customerId)
            .order('order_date', { ascending: false })

          // Table doesn't exist (42P01) is not an error - just means no legacy orders
          if (legacyOrdersResult.error && legacyOrdersResult.error.code !== '42P01') {
            console.error('Error fetching legacy orders:', legacyOrdersResult.error)
            // Don't throw - just log and continue with empty legacy orders
          } else if (!legacyOrdersResult.error) {
            legacyOrders = (legacyOrdersResult.data || []).map(order => ({
              ...order,
              isLegacy: true,
              orderDate: order.order_date
            }))
          }
        } catch (legacyErr) {
          console.error('Exception fetching legacy orders:', legacyErr)
          // Continue without legacy orders
        }

        // Combine and sort by date (newest first)
        const allOrders = [...newOrders, ...legacyOrders].sort(
          (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
        )

        setCombinedOrders(allOrders)
      } catch (err) {
        console.error('Error in useCombinedOrders:', err)
        setError(err.message)
        setCombinedOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchAllOrders()
  }, [customerId])

  return { orders: combinedOrders, loading, error }
}

/**
 * Fetch and manage customer addresses
 */
export function useAddresses(customerId) {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) {
      setLoading(false)
      return
    }

    fetchAddresses()
  }, [customerId])

  async function fetchAddresses() {
    try {
      setLoading(true)
      setError(null)

      const { data, error: supabaseError } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })

      if (supabaseError) throw supabaseError

      // Map address_line1/2 to street/unit for component compatibility
      const mappedAddresses = (data || []).map(addr => ({
        ...addr,
        street: addr.address_line1,
        unit: addr.address_line2,
        company: addr.company
      }))
      setAddresses(mappedAddresses)
    } catch (err) {
      setError(err.message)
      setAddresses([])
    } finally {
      setLoading(false)
    }
  }

  const addAddress = useCallback(async (address) => {
    if (!customerId) return { error: 'No customer ID' }

    try {
      // If this is the first address or marked as default, update others
      if (address.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId)
      }

      // Map street/unit to address_line1/2 for database
      const { street, unit, company, ...rest } = address
      const dbAddress = {
        ...rest,
        address_line1: street,
        address_line2: unit || null,
        company: company || null
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({ customer_id: customerId, ...dbAddress })
        .select()
        .single()

      if (error) throw error
      await fetchAddresses()
      return { data }
    } catch (err) {
      return { error: err.message }
    }
  }, [customerId])

  const updateAddress = useCallback(async (addressId, updates) => {
    try {
      if (updates.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId)
      }

      // Map street/unit to address_line1/2 for database
      const { street, unit, company, ...rest } = updates
      const dbUpdates = {
        ...rest,
        updated_at: new Date().toISOString()
      }
      if (street !== undefined) dbUpdates.address_line1 = street
      if (unit !== undefined) dbUpdates.address_line2 = unit || null
      if (company !== undefined) dbUpdates.company = company || null

      const { data, error } = await supabase
        .from('customer_addresses')
        .update(dbUpdates)
        .eq('id', addressId)
        .select()
        .single()

      if (error) throw error
      await fetchAddresses()
      return { data }
    } catch (err) {
      return { error: err.message }
    }
  }, [customerId])

  const deleteAddress = useCallback(async (addressId) => {
    try {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId)

      if (error) throw error
      await fetchAddresses()
      return { success: true }
    } catch (err) {
      return { error: err.message }
    }
  }, [])

  const setDefaultAddress = useCallback(async (addressId) => {
    return updateAddress(addressId, { is_default: true })
  }, [updateAddress])

  return { addresses, loading, error, addAddress, updateAddress, deleteAddress, setDefaultAddress, refetch: fetchAddresses }
}

/**
 * Enrich bundle products with stock derived from component product availability.
 * A bundle is in stock only if ALL component products have sufficient quantity.
 * Effective bundle quantity = MIN(FLOOR(component_qty / required_qty)) across all components.
 */
export async function enrichBundleStock(products) {
  const bundles = products.filter(p => p.product_type === 'bundle')
  if (bundles.length === 0) return products

  const bundleIds = bundles.map(p => p.id)

  // Fetch relationships for all bundle products
  const { data: relationships, error } = await supabase
    .from('product_relationships')
    .select('parent_product_id, child_product_id, quantity')
    .in('parent_product_id', bundleIds)
    .eq('relationship_type', 'bundle')

  if (error || !relationships || relationships.length === 0) return products

  // Collect child product IDs that aren't already in the products array
  const productMap = new Map(products.map(p => [p.id, p]))
  const missingChildIds = relationships
    .map(r => r.child_product_id)
    .filter(id => !productMap.has(id))
  const uniqueMissingIds = [...new Set(missingChildIds)]

  // Fetch any missing child products (e.g. inactive products not in the main query)
  if (uniqueMissingIds.length > 0) {
    const { data: missingProducts } = await supabase
      .from('products')
      .select('id, name, quantity_available, track_inventory, stock_status')
      .in('id', uniqueMissingIds)

    if (missingProducts) {
      missingProducts.forEach(p => productMap.set(p.id, p))
    }
  }

  // Group relationships by parent bundle
  const bundleRels = {}
  for (const rel of relationships) {
    if (!bundleRels[rel.parent_product_id]) {
      bundleRels[rel.parent_product_id] = []
    }
    bundleRels[rel.parent_product_id].push(rel)
  }

  // Compute effective stock for each bundle
  return products.map(product => {
    if (product.product_type !== 'bundle') return product

    const rels = bundleRels[product.id]
    if (!rels || rels.length === 0) return product

    const effectiveQty = Math.min(
      ...rels.map(r => {
        const child = productMap.get(r.child_product_id)
        if (!child) return 0
        // If child doesn't track inventory, check stock_status
        if (child.track_inventory === false) {
          return child.stock_status === 'in_stock' ? 999 : 0
        }
        const childQty = child.quantity_available ?? 0
        const reqQty = r.quantity || 1
        return Math.floor(childQty / reqQty)
      })
    )

    // Build bundleItems array with component names and quantities
    const bundleItems = rels
      .map(r => {
        const child = productMap.get(r.child_product_id)
        return child?.name
          ? { name: child.name, quantity: r.quantity || 1 }
          : null
      })
      .filter(Boolean)

    return {
      ...product,
      quantity_available: effectiveQty,
      stock_status: effectiveQty > 0 ? 'in_stock' : 'out_of_stock',
      bundleItems
    }
  })
}

/**
 * Fetch all active products with category and primary image
 * Includes realtime subscription to automatically update when products change
 */
export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: supabaseError } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(*),
          images:product_images(*),
          category_assignments:product_category_assignments(category_id, category:product_categories(*)),
          tag_assignments:product_tag_assignments(tag_id, tag:product_tags(*))
        `)
        .eq('is_active', true)
        .order('name')

      if (supabaseError) throw supabaseError

      // Extract primary image for each product
      const productsWithPrimaryImage = data.map(product => ({
        ...product,
        primary_image: product.images?.find(img => img.is_primary) || product.images?.[0] || null
      }))

      // Derive bundle stock from component product availability
      const enrichedProducts = await enrichBundleStock(productsWithPrimaryImage)

      setProducts(enrichedProducts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()

    // Subscribe to realtime changes on products table
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          fetchProducts()
        }
      )
      .subscribe()

    // Subscribe to category assignment changes (many-to-many)
    const assignmentsChannel = supabase
      .channel('product-category-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_category_assignments'
        },
        () => {
          fetchProducts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(assignmentsChannel)
    }
  }, [fetchProducts])

  return { products, loading, error, refetch: fetchProducts }
}

/**
 * Fetch top 8 best-selling active products
 * Calculates sales from order_items (excluding cancelled orders)
 * Includes realtime subscription to automatically update when products change
 */
export function useBestSellers(limit = 8) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBestSellers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch active products with category and images
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(*),
          images:product_images(*)
        `)
        .eq('is_active', true)

      if (productsError) throw productsError

      // Fetch order items to calculate sales (excluding cancelled orders)
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(status)')

      if (orderItemsError) throw orderItemsError

      // Calculate total sales per product
      const salesCounts = {}
      ;(orderItemsData || []).forEach(item => {
        if (item.orders?.status !== 'cancelled') {
          salesCounts[item.product_id] = (salesCounts[item.product_id] || 0) + item.quantity
        }
      })

      // Add primary image and sales count to each product
      const productsWithSales = (productsData || []).map(product => ({
        ...product,
        primary_image: product.images?.find(img => img.is_primary) || product.images?.[0] || null,
        sales_count: salesCounts[product.id] || 0
      }))

      // Derive bundle stock from component product availability
      const enrichedProducts = await enrichBundleStock(productsWithSales)

      // Sort by sales count descending and take top N
      const bestSellers = enrichedProducts
        .sort((a, b) => b.sales_count - a.sales_count)
        .slice(0, limit)

      setProducts(bestSellers)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchBestSellers()

    // Subscribe to realtime changes on products table
    const channel = supabase
      .channel('bestsellers-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          // Refetch best sellers when any product changes
          fetchBestSellers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBestSellers])

  return { products, loading, error, refetch: fetchBestSellers }
}

/**
 * Fetch a single product by slug
 */
export function useProduct(slug) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    async function fetchProduct() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('products')
          .select(`
            *,
            category:product_categories(*),
            images:product_images(*)
          `)
          .eq('slug', slug)
          .single()

        if (supabaseError) throw supabaseError

        // Extract primary image
        const productWithPrimaryImage = {
          ...data,
          primary_image: data.images?.find(img => img.is_primary) || data.images?.[0] || null
        }

        setProduct(productWithPrimaryImage)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [slug])

  return { product, loading, error }
}

/**
 * Fetch all active categories
 * Includes realtime subscription to automatically update when categories change
 */
export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: supabaseError } = await supabase
        .from('product_categories')
        .select('*, parent:parent_id(id, name)')
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })

      if (supabaseError) throw supabaseError

      setCategories(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()

    // Subscribe to realtime changes on product_categories table
    const channel = supabase
      .channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_categories'
        },
        () => {
          // Refetch categories when any change occurs
          fetchCategories()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCategories])

  return { categories, loading, error, refetch: fetchCategories }
}

/**
 * Manage cart state with localStorage persistence
 */
/**
 * Fetch all growers
 */
export function useGrowers() {
  const [growers, setGrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchGrowers() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('growers')
          .select('*')
          .eq('is_active', true)
          .order('display_order')

        if (supabaseError) throw supabaseError

        setGrowers(data || [])
      } catch (err) {
        // If table doesn't exist or other error, use empty array
        setError(err.message)
        setGrowers([])
      } finally {
        setLoading(false)
      }
    }

    fetchGrowers()
  }, [])

  return { growers, loading, error }
}

/**
 * Fetch attribution options for order confirmation survey
 */
export function useAttributionOptions() {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchOptions() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('attribution_options')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')

        if (supabaseError) throw supabaseError

        setOptions(data || [])
      } catch (err) {
        setError(err.message)
        // Fallback options if table doesn't exist
        setOptions([
          { id: '1', label: 'Instagram', value: 'instagram' },
          { id: '2', label: 'Facebook', value: 'facebook' },
          { id: '3', label: 'TikTok', value: 'tiktok' },
          { id: '4', label: 'Google Search', value: 'google' },
          { id: '5', label: 'Friend / Referral', value: 'referral' },
          { id: '6', label: 'Farmers Market', value: 'farmers_market' },
          { id: '7', label: 'Other', value: 'other' }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [])

  return { options, loading, error }
}

/**
 * Fetch all active shipping services
 */
export function useShippingServices() {
  const [shippingServices, setShippingServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchShippingServices() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('shipping_services')
          .select('*')
          .eq('is_enabled', true)
          .order('sort_order')

        if (supabaseError) throw supabaseError

        // Map to expected format (display_name -> name, base_price -> price)
        const mappedServices = (data || []).map(service => ({
          id: service.id,
          name: service.display_name,
          description: service.description || `${service.min_transit_days}-${service.max_transit_days} Business Days`,
          price: parseFloat(service.base_price) || 0,
          is_active: service.is_enabled
        }))

        setShippingServices(mappedServices)
      } catch (err) {
        // If table doesn't exist or other error, use fallback data
        setError(err.message)
        setShippingServices([
          {
            id: 'standard',
            name: 'Standard Ground',
            description: '3-5 Business Days. Recommended for hardy vegetables.',
            price: 8.99,
            is_active: true
          },
          {
            id: 'express',
            name: '2-Day Express',
            description: 'Fastest delivery. Best for sensitive flowers and herbs.',
            price: 14.99,
            is_active: true
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchShippingServices()
  }, [])

  return { shippingServices, loading, error }
}

/**
 * Generate a unique order number
 */
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ATL-${timestamp}-${random}`
}

/**
 * Create an order with order items
 * Uses atomic RPC function to check inventory and deduct stock
 */
export function useCreateOrder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createOrder = useCallback(async ({
    cartItems,
    customerInfo,
    shippingInfo,
    shippingMethod,
    shippingCost,
    customerId = null,
    saveAddress = false,
    // ShipEngine shipping details
    shippingRateId = null,
    shippingCarrierId = null,
    shippingServiceCode = null,
    shippingMethodName = null,
    estimatedDeliveryDate = null,
    addressValidated = false,
    addressOriginal = null,
    addressNormalized = null,
    // Local Pickup details
    isPickup = false,
    pickupLocationId = null,
    pickupDate = null,
    pickupTimeStart = null,
    pickupTimeEnd = null,
    pickupScheduleId = null,
    // Promotion details
    promotionId = null,
    promotionCode = null,
    discountAmount = 0,
    discountDescription = null,
    // Customer notes
    customerNotes = null,
    // Growing system
    growingSystem = null,
    // Payment status (for Stripe flow: 'pending' until payment completes)
    paymentStatus = null,
    // Tax (pre-calculated by caller via calculateTax utility)
    tax: preCalculatedTax = null,
    taxRateApplied = null,
    taxNote = null
  }) => {
    setLoading(true)
    setError(null)

    try {
      // Calculate totals
      const subtotal = cartItems.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      )
      // Use pre-calculated tax from caller; fallback to 7% GA rate for backward compat
      const tax = preCalculatedTax != null ? preCalculatedTax : Math.round(subtotal * 0.07 * 100) / 100
      const total = subtotal + shippingCost + tax - discountAmount

      // Prepare order data for RPC
      const orderData = {
        customer_id: customerId,
        guest_email: customerId ? null : customerInfo.email,
        guest_phone: customerId ? null : customerInfo.phone,
        shipping_first_name: shippingInfo?.firstName || customerInfo.firstName,
        shipping_last_name: shippingInfo?.lastName || customerInfo.lastName,
        shipping_company: shippingInfo?.company || null,
        shipping_address_line1: shippingInfo?.address1 || null,
        shipping_address_line2: shippingInfo?.address2 || null,
        shipping_city: shippingInfo?.city || null,
        shipping_state: shippingInfo?.state || null,
        shipping_zip: shippingInfo?.zip || null,
        shipping_country: shippingInfo?.country || 'US',
        shipping_phone: shippingInfo?.phone || customerInfo.phone,
        shipping_method: shippingMethodName || shippingMethod,
        shipping_cost: shippingCost,
        subtotal,
        tax,
        total,
        // ShipEngine shipping details
        shipping_rate_id: shippingRateId,
        shipping_carrier_id: shippingCarrierId,
        shipping_service_code: shippingServiceCode,
        shipping_method_name: shippingMethodName,
        estimated_delivery_date: estimatedDeliveryDate,
        shipping_address_validated: addressValidated,
        shipping_address_original: addressOriginal,
        shipping_address_normalized: addressNormalized,
        // Local Pickup details
        is_pickup: isPickup,
        pickup_location_id: pickupLocationId,
        pickup_date: pickupDate,
        pickup_time_start: pickupTimeStart,
        pickup_time_end: pickupTimeEnd,
        // Promotion details
        promotion_id: promotionId,
        promotion_code: promotionCode,
        discount_amount: discountAmount,
        discount_description: discountDescription,
        // Customer notes
        customer_notes: customerNotes,
        // Growing system
        growing_system: growingSystem,
        // Payment status
        payment_status: paymentStatus || 'pending',
        // Tax audit
        tax_rate_applied: taxRateApplied,
        tax_note: taxNote
      }

      // Prepare order items for RPC
      const orderItems = cartItems.map(item => ({
        product_id: item.id || item.product?.id,
        product_name: item.name || item.product?.name,
        product_price: item.price || item.product?.price,
        quantity: item.quantity,
        line_total: (item.price || item.product?.price) * item.quantity
      }))

      // Call atomic RPC function that checks stock and creates order
      // NOTE: Admin order creation (OrderCreatePage.tsx) uses the same RPC directly — keep order data shape in sync
      const { data: result, error: rpcError } = await supabase.rpc(
        'create_order_with_inventory_check',
        {
          p_order_data: orderData,
          p_order_items: orderItems
        }
      )

      if (rpcError) throw rpcError

      // Check if RPC returned an error (e.g., insufficient stock)
      if (!result.success) {
        const errorMessage = result.message || 'Failed to create order'
        throw new Error(errorMessage)
      }

      // Order created successfully - now handle non-critical updates

      // Record promotion usage if a promotion was applied
      if (promotionId && discountAmount > 0) {
        const { error: usageError } = await supabase
          .from('promotion_usage')
          .insert({
            promotion_id: promotionId,
            order_id: result.order_id,
            customer_id: customerId,
            customer_email: customerInfo.email,
            discount_amount: discountAmount
          })

        if (usageError) {
          console.error('Error recording promotion usage:', usageError)
          // Don't fail the order if usage tracking fails - the order itself succeeded
        }

        // Update promotion stats
        const { error: statsError } = await supabase.rpc('increment_promotion_usage', {
          p_promotion_id: promotionId,
          p_discount_amount: discountAmount
        })

        if (statsError) {
          console.error('Error updating promotion stats:', statsError)
          // Don't fail the order if stats update fails
        }
      }

      // Create pickup reservation if this is a pickup order
      if (isPickup && pickupLocationId && pickupDate && pickupTimeStart && pickupTimeEnd) {
        const { error: reservationError } = await supabase
          .from('pickup_reservations')
          .insert({
            order_id: result.order_id,
            location_id: pickupLocationId,
            schedule_id: pickupScheduleId,
            pickup_date: pickupDate,
            pickup_time_start: pickupTimeStart,
            pickup_time_end: pickupTimeEnd,
            status: 'scheduled'
          })

        if (reservationError) {
          console.error('Error creating pickup reservation:', reservationError)
          // Don't fail the order if reservation creation fails - the order itself succeeded
        }
      }

      // Update customer record if logged in
      if (customerId) {
        const { error: customerError } = await supabase
          .from('customers')
          .upsert({
            id: customerId,
            first_name: customerInfo.firstName,
            last_name: customerInfo.lastName,
            email: customerInfo.email,
            phone: customerInfo.phone,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })

        if (customerError) {
          console.error('Error updating customer:', customerError)
          // Don't fail the order if customer update fails
        }

        // Save shipping address to address book if requested
        if (saveAddress) {
          // Check if this address already exists for the customer
          const { data: existingAddresses } = await supabase
            .from('customer_addresses')
            .select('id')
            .eq('customer_id', customerId)
            .eq('address_line1', shippingInfo.address1)
            .eq('city', shippingInfo.city)
            .eq('state', shippingInfo.state)
            .eq('zip', shippingInfo.zip)
            .limit(1)

          // Only insert if no matching address exists
          if (!existingAddresses || existingAddresses.length === 0) {
            const { error: addressError } = await supabase
              .from('customer_addresses')
              .insert({
                customer_id: customerId,
                label: 'Shipping',
                first_name: shippingInfo.firstName,
                last_name: shippingInfo.lastName,
                company: shippingInfo.company || null,
                address_line1: shippingInfo.address1,
                address_line2: shippingInfo.address2 || null,
                city: shippingInfo.city,
                state: shippingInfo.state,
                zip: shippingInfo.zip,
                phone: customerInfo.phone,
                is_default: false
              })

            if (addressError) {
              console.error('Error saving address:', addressError)
              // Don't fail the order if address save fails
            }
          }
        }
      }

      // Return the complete order with items
      return {
        success: true,
        order: {
          id: result.order_id,
          order_number: result.order_number,
          ...orderData,
          status: 'pending_payment',
          items: cartItems.map(item => ({
            id: item.id || item.product?.id,
            name: item.name || item.product?.name,
            price: item.price || item.product?.price,
            quantity: item.quantity,
            image: item.image || item.product?.primary_image_url || item.product?.image,
            category: item.category || item.product?.category?.name,
            bundleItems: item.bundleItems || undefined
          }))
        }
      }
    } catch (err) {
      console.error('Error creating order:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { createOrder, loading, error }
}

/**
 * Fetch branding settings from config_settings table
 * Used for announcement bar, logo, colors, etc.
 */
export function useBrandingSettings() {
  const [settings, setSettings] = useState({
    announcement_bar_enabled: false,
    announcement_bar_text: '',
    homepage_announcement: '',
    logo_url: '',
    primary_brand_color: '#10b981',
    secondary_brand_color: '#047857',
    heading_font: 'Plus Jakarta Sans',
    heading_font_size: 28,
    body_font: 'Inter',
    body_font_size: 16,
    background_color: '#fafafa',
    secondary_background_color: '#ffffff'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchBrandingSettings() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('config_settings')
          .select('key, value, data_type')
          .eq('category', 'branding')

        if (supabaseError) throw supabaseError

        // Parse settings into an object
        const brandingSettings = {}
        ;(data || []).forEach(setting => {
          let parsedValue = setting.value
          if (setting.data_type === 'boolean') {
            parsedValue = setting.value === 'true'
          } else if (setting.data_type === 'number') {
            parsedValue = parseFloat(setting.value)
          }
          brandingSettings[setting.key] = parsedValue
        })

        setSettings(prev => ({ ...prev, ...brandingSettings }))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchBrandingSettings()
  }, [])

  return { settings, loading, error }
}

/**
 * Subscribe to back-in-stock alerts for a product
 */
export function useBackInStockAlert() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const subscribe = useCallback(async ({ productId, email, customerId = null }) => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Check if already subscribed
      const { data: existing, error: checkError } = await supabase
        .from('back_in_stock_alerts')
        .select('id, status')
        .eq('product_id', productId)
        .eq('email', email)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existing) {
        if (existing.status === 'pending') {
          setError('You are already subscribed to alerts for this product.')
          return { success: false, alreadySubscribed: true }
        }
        // If previously notified or cancelled, update to pending
        const { error: updateError } = await supabase
          .from('back_in_stock_alerts')
          .update({ status: 'pending', notified_at: null, customer_id: customerId })
          .eq('id', existing.id)

        if (updateError) throw updateError
      } else {
        // Insert new subscription
        const { error: insertError } = await supabase
          .from('back_in_stock_alerts')
          .insert({
            product_id: productId,
            email: email,
            customer_id: customerId,
            status: 'pending'
          })

        if (insertError) throw insertError
      }

      setSuccess(true)
      return { success: true }
    } catch (err) {
      console.error('Error subscribing to back-in-stock alert:', err)
      setError(err.message || 'Failed to subscribe. Please try again.')
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
  }, [])

  return { subscribe, loading, error, success, reset }
}

/**
 * Manage customer favorites (wishlist) with database persistence
 * Requires authentication - anonymous users see no favorites
 * localStorage is only used to sync favorites to DB on login
 */
export function useFavorites(userId) {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch favorites from database (requires auth)
  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (userId) {
        // Logged in - fetch from database
        const { data, error: supabaseError } = await supabase
          .from('customer_favorites')
          .select('product_id, created_at')
          .eq('customer_id', userId)
          .order('created_at', { ascending: false })

        if (supabaseError) throw supabaseError
        setFavorites((data || []).map(f => f.product_id))
      } else {
        // Not logged in - no favorites
        setFavorites([])
      }
    } catch (err) {
      console.error('Error fetching favorites:', err)
      setError(err.message)
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  // Check if a product is favorited
  const isFavorite = useCallback((productId) => {
    return favorites.includes(productId)
  }, [favorites])

  // Toggle favorite status for a product (requires auth)
  const toggleFavorite = useCallback(async (productId) => {
    if (!userId) {
      return { success: false, error: 'Login required to save favorites' }
    }

    const isCurrentlyFavorited = favorites.includes(productId)

    try {
      if (isCurrentlyFavorited) {
        const { error: deleteError } = await supabase
          .from('customer_favorites')
          .delete()
          .eq('customer_id', userId)
          .eq('product_id', productId)

        if (deleteError) throw deleteError
      } else {
        const { error: insertError } = await supabase
          .from('customer_favorites')
          .insert({ customer_id: userId, product_id: productId })

        if (insertError) throw insertError
      }

      // Update local state
      const newFavorites = isCurrentlyFavorited
        ? favorites.filter(id => id !== productId)
        : [...favorites, productId]

      setFavorites(newFavorites)

      return { success: true, isFavorited: !isCurrentlyFavorited }
    } catch (err) {
      console.error('Error toggling favorite:', err)
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [userId, favorites])

  // Sync localStorage favorites to database when user logs in
  const syncLocalFavoritesToDatabase = useCallback(async () => {
    if (!userId) return

    try {
      const localFavorites = JSON.parse(localStorage.getItem('atl_wishlist') || '[]')
      if (localFavorites.length === 0) return

      // Get existing database favorites
      const { data: existingFavorites } = await supabase
        .from('customer_favorites')
        .select('product_id')
        .eq('customer_id', userId)

      const existingIds = (existingFavorites || []).map(f => f.product_id)

      // Find favorites that need to be added to the database
      const newFavorites = localFavorites.filter(id => !existingIds.includes(id))

      if (newFavorites.length > 0) {
        const { error: insertError } = await supabase
          .from('customer_favorites')
          .insert(newFavorites.map(productId => ({
            customer_id: userId,
            product_id: productId
          })))

        if (insertError) {
          console.error('Error syncing favorites:', insertError)
        }
      }

      // Clear localStorage after successful sync
      localStorage.removeItem('atl_wishlist')

      // Refetch to get merged list
      await fetchFavorites()
    } catch (err) {
      console.error('Error syncing favorites:', err)
    }
  }, [userId, fetchFavorites])

  return {
    favorites,
    loading,
    error,
    isFavorite,
    toggleFavorite,
    syncLocalFavoritesToDatabase,
    refetch: fetchFavorites
  }
}

export function useCart() {
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart')
      if (savedCart) {
        setCart(JSON.parse(savedCart))
      }
    } catch (err) {
      setError('Failed to load cart')
    } finally {
      setLoading(false)
    }
  }, [])

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('cart', JSON.stringify(cart))
    }
  }, [cart, loading])

  const addItem = useCallback((product, quantity = 1) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.product.id === product.id)

      if (existingItem) {
        return currentCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }

      return [...currentCart, { product, quantity }]
    })
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    setCart(currentCart =>
      currentCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    )
  }, [])

  const removeItem = useCallback((productId) => {
    setCart(currentCart =>
      currentCart.filter(item => item.product.id !== productId)
    )
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const cartTotal = cart.reduce(
    (total, item) => total + (item.product.price * item.quantity),
    0
  )

  const cartCount = cart.reduce(
    (count, item) => count + item.quantity,
    0
  )

  return {
    cart,
    loading,
    error,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    cartTotal,
    cartCount
  }
}

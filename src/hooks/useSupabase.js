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

        const { data, error: supabaseError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', userId)
          .single()

        if (supabaseError && supabaseError.code !== 'PGRST116') {
          throw supabaseError
        }

        setProfile(data)
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
      const { data, error } = await supabase
        .from('customers')
        .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      return { data }
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
              product:products(name, slug, primary_image_url)
            )
          `)
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })

        if (supabaseError) throw supabaseError
        setOrders(data || [])
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
        unit: addr.address_line2
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
      const { street, unit, ...rest } = address
      const dbAddress = {
        ...rest,
        address_line1: street,
        address_line2: unit || null
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
      const { street, unit, ...rest } = updates
      const dbUpdates = {
        ...rest,
        updated_at: new Date().toISOString()
      }
      if (street !== undefined) dbUpdates.address_line1 = street
      if (unit !== undefined) dbUpdates.address_line2 = unit || null

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
 * Fetch all active products with category and primary image
 */
export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchProducts() {
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
          .eq('is_active', true)
          .order('name')

        if (supabaseError) throw supabaseError

        // Extract primary image for each product
        const productsWithPrimaryImage = data.map(product => ({
          ...product,
          primary_image: product.images?.find(img => img.is_primary) || product.images?.[0] || null
        }))

        setProducts(productsWithPrimaryImage)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return { products, loading, error }
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
 */
export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: supabaseError } = await supabase
          .from('product_categories')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (supabaseError) throw supabaseError

        setCategories(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  return { categories, loading, error }
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
          .order('display_order')

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
    saveAddress = false
  }) => {
    setLoading(true)
    setError(null)

    try {
      // Calculate totals
      const subtotal = cartItems.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      )
      const taxRate = 0.08 // 8% tax
      const tax = subtotal * taxRate
      const total = subtotal + shippingCost + tax

      // Prepare order data for RPC
      const orderData = {
        customer_id: customerId,
        guest_email: customerId ? null : customerInfo.email,
        guest_phone: customerId ? null : customerInfo.phone,
        shipping_first_name: shippingInfo.firstName,
        shipping_last_name: shippingInfo.lastName,
        shipping_address_line1: shippingInfo.address1,
        shipping_address_line2: shippingInfo.address2 || null,
        shipping_city: shippingInfo.city,
        shipping_state: shippingInfo.state,
        shipping_zip: shippingInfo.zip,
        shipping_country: shippingInfo.country || 'US',
        shipping_phone: customerInfo.phone,
        shipping_method: shippingMethod,
        shipping_cost: shippingCost,
        subtotal,
        tax,
        total
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
          status: 'pending',
          items: cartItems.map(item => ({
            id: item.id || item.product?.id,
            name: item.name || item.product?.name,
            price: item.price || item.product?.price,
            quantity: item.quantity,
            image: item.image || item.product?.primary_image_url || item.product?.image,
            category: item.category || item.product?.category?.name
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

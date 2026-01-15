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
 * Fetch customer profile data
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
          .from('customer_profiles')
          .select('*')
          .eq('user_id', userId)
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
        .from('customer_profiles')
        .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
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
      setAddresses(data || [])
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

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({ customer_id: customerId, ...address })
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

      const { data, error } = await supabase
        .from('customer_addresses')
        .update({ ...updates, updated_at: new Date().toISOString() })
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
          .eq('is_active', true)
          .order('price')

        if (supabaseError) throw supabaseError

        setShippingServices(data || [])
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
    customerId = null
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

      // Generate order number
      const orderNumber = generateOrderNumber()

      // Create the order
      const orderData = {
        order_number: orderNumber,
        customer_id: customerId,
        guest_email: customerId ? null : customerInfo.email,
        guest_phone: customerId ? null : customerInfo.phone,
        guest_first_name: customerId ? null : customerInfo.firstName,
        guest_last_name: customerId ? null : customerInfo.lastName,
        shipping_first_name: shippingInfo.firstName,
        shipping_last_name: shippingInfo.lastName,
        shipping_address1: shippingInfo.address1,
        shipping_address2: shippingInfo.address2 || null,
        shipping_city: shippingInfo.city,
        shipping_state: shippingInfo.state,
        shipping_zip: shippingInfo.zip,
        shipping_country: shippingInfo.country || 'United States',
        shipping_method: shippingMethod,
        shipping_cost: shippingCost,
        subtotal,
        tax,
        total,
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date().toISOString()
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id || item.product?.id,
        product_name: item.name || item.product?.name,
        product_image: item.image || item.product?.primary_image_url || item.product?.image,
        quantity: item.quantity,
        unit_price: item.price || item.product?.price,
        total_price: (item.price || item.product?.price) * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // Return the complete order with items
      return {
        success: true,
        order: {
          ...order,
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

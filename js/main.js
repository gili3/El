/**
 * Main Application Module
 * Coordinates all services and handles application lifecycle
 */

const AdminApp = (function() {
    'use strict';
    
    // Private variables
    let isInitialized = false;
    let currentTab = 'dashboard';
    let realTimeSubscriptions = [];
    
    /**
     * Initialize the application
     */
    async function init() {
        try {
            console.log('🚀 بدء تحميل لوحة تحكم Queen Beauty');
            
            // Show loading screen
            UIHelpers.showLoading('loadingScreen');
            
            // Check authentication
            await checkAuthentication();
            
            // Initialize Firebase
            const firebaseInitialized = await FirebaseService.initialize();
            if (!firebaseInitialized) {
                throw new Error('فشل تهيئة قاعدة البيانات');
            }
            
            // Initialize other services
            ProductService.init();
            OrderService.init();
            UserService.init();
            SettingsService.init();
            
            // Setup UI
            setupUI();
            
            // Setup real-time updates
            setupRealtimeUpdates();
            
            // Load initial data
            await loadInitialData();
            
            // Hide loading screen and show app
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('appContainer').style.display = 'block';
            
            isInitialized = true;
            console.log('🎉 لوحة التحكم جاهزة للاستخدام');
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة التطبيق:', error);
            showErrorPage(error);
        }
    }
    
    /**
     * Check user authentication
     */
    async function checkAuthentication() {
        // Check if user is logged in
        const currentUser = FirebaseService.getCurrentUser();
        
        if (!currentUser) {
            // Redirect to login page
            window.location.href = 'login.html';
            return;
        }
        
        // Verify admin privileges (handled in FirebaseService)
        console.log('🔐 التحقق من الصلاحيات...');
    }
    
    /**
     * Setup UI components and event listeners
     */
    function setupUI() {
        console.log('🎨 تهيئة واجهة المستخدم...');
        
        // Setup tab navigation
        setupTabs();
        
        // Setup search functionality
        setupSearch();
        
        // Setup filters
        setupFilters();
        
        // Setup buttons
        setupButtons();
        
        // Setup modals
        setupModals();
        
        // Setup keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Update connection status
        updateConnectionStatus();
    }
    
    /**
     * Setup tab navigation
     */
    function setupTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', async function() {
                const tabId = this.dataset.tab;
                if (!tabId || tabId === currentTab) return;
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                    content.setAttribute('hidden', '');
                });
                
                // Show selected tab content
                const targetTab = document.getElementById(tabId);
                if (targetTab) {
                    targetTab.classList.add('active');
                    targetTab.removeAttribute('hidden');
                }
                
                // Update current tab
                currentTab = tabId;
                
                // Load data for the selected tab
                await loadTabData(tabId);
            });
        });
    }
    
    /**
     * Setup search functionality
     */
    function setupSearch() {
        // Product search
        const productSearch = document.getElementById('productSearch');
        if (productSearch) {
            const searchHandler = UIHelpers.debounce(async (value) => {
                await loadProducts({ search: value });
            }, 300);
            
            productSearch.addEventListener('input', (e) => {
                searchHandler(e.target.value);
            });
        }
        
        // Order search
        const orderSearch = document.getElementById('orderSearch');
        if (orderSearch) {
            const searchHandler = UIHelpers.debounce(async (value) => {
                await loadOrders({ search: value });
            }, 300);
            
            orderSearch.addEventListener('input', (e) => {
                searchHandler(e.target.value);
            });
        }
        
        // User search
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            const searchHandler = UIHelpers.debounce(async (value) => {
                await loadUsers({ search: value });
            }, 300);
            
            userSearch.addEventListener('input', (e) => {
                searchHandler(e.target.value);
            });
        }
    }
    
    /**
     * Setup filters
     */
    function setupFilters() {
        // Product filters
        const productCategoryFilter = document.getElementById('productCategoryFilter');
        const productStatusFilter = document.getElementById('productStatusFilter');
        const productSort = document.getElementById('productSort');
        
        if (productCategoryFilter) {
            productCategoryFilter.addEventListener('change', async () => {
                await loadProducts({
                    category: productCategoryFilter.value,
                    status: productStatusFilter.value,
                    sort: productSort.value
                });
            });
        }
        
        if (productStatusFilter) {
            productStatusFilter.addEventListener('change', async () => {
                await loadProducts({
                    category: productCategoryFilter.value,
                    status: productStatusFilter.value,
                    sort: productSort.value
                });
            });
        }
        
        if (productSort) {
            productSort.addEventListener('change', async () => {
                await loadProducts({
                    category: productCategoryFilter.value,
                    status: productStatusFilter.value,
                    sort: productSort.value
                });
            });
        }
        
        // Order filters
        const orderStatusFilter = document.getElementById('orderStatusFilter');
        const orderDateFrom = document.getElementById('orderDateFrom');
        const orderDateTo = document.getElementById('orderDateTo');
        
        if (orderStatusFilter) {
            orderStatusFilter.addEventListener('change', async () => {
                await loadOrders({
                    status: orderStatusFilter.value,
                    dateFrom: orderDateFrom.value,
                    dateTo: orderDateTo.value
                });
            });
        }
        
        if (orderDateFrom) {
            orderDateFrom.addEventListener('change', async () => {
                await loadOrders({
                    status: orderStatusFilter.value,
                    dateFrom: orderDateFrom.value,
                    dateTo: orderDateTo.value
                });
            });
        }
        
        if (orderDateTo) {
            orderDateTo.addEventListener('change', async () => {
                await loadOrders({
                    status: orderStatusFilter.value,
                    dateFrom: orderDateFrom.value,
                    dateTo: orderDateTo.value
                });
            });
        }
    }
    
    /**
     * Setup buttons
     */
    function setupButtons() {
        // Refresh buttons
        const refreshButtons = document.querySelectorAll('[onclick*="refresh"]');
        refreshButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                refreshCurrentTab();
            });
        });
        
        // Export buttons
        const exportButtons = document.querySelectorAll('[onclick*="export"]');
        exportButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleExport(btn);
            });
        });
        
        // Print buttons
        const printButtons = document.querySelectorAll('[onclick*="print"]');
        printButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                handlePrint(btn);
            });
        });
    }
    
    /**
     * Setup modals
     */
    function setupModals() {
        // Product modal
        const productModal = document.getElementById('productModal');
        if (productModal) {
            productModal.addEventListener('click', (e) => {
                if (e.target === productModal) {
                    closeModal(productModal);
                }
            });
        }
        
        // Image upload modal
        const imageUploadModal = document.getElementById('imageUploadModal');
        if (imageUploadModal) {
            imageUploadModal.addEventListener('click', (e) => {
                if (e.target === imageUploadModal) {
                    closeModal(imageUploadModal);
                }
            });
        }
        
        // Confirm modal
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.addEventListener('click', (e) => {
                if (e.target === confirmModal) {
                    closeModal(confirmModal);
                }
            });
        }
    }
    
    /**
     * Setup keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCurrentTab();
            }
            
            // Ctrl/Cmd + F to search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                focusSearch();
            }
            
            // Esc to close modals
            if (e.key === 'Escape') {
                closeAllModals();
            }
            
            // F5 to refresh
            if (e.key === 'F5') {
                e.preventDefault();
                refreshCurrentTab();
            }
        });
    }
    
    /**
     * Setup real-time updates
     */
    function setupRealtimeUpdates() {
        // Subscribe to product updates
        const productsUnsubscribe = ProductService.setupRealtimeUpdates((products) => {
            updateProductBadge(products);
            if (currentTab === 'products') {
                renderProducts(products);
            }
        });
        
        if (productsUnsubscribe) {
            realTimeSubscriptions.push(productsUnsubscribe);
        }
        
        // Subscribe to order updates
        const ordersUnsubscribe = OrderService.setupRealtimeUpdates((orders) => {
            updateOrderBadge(orders);
            if (currentTab === 'orders') {
                renderOrders(orders);
            }
        });
        
        if (ordersUnsubscribe) {
            realTimeSubscriptions.push(ordersUnsubscribe);
        }
        
        // Subscribe to user updates
        const usersUnsubscribe = UserService.setupRealtimeUpdates((users) => {
            if (currentTab === 'users') {
                renderUsers(users);
            }
        });
        
        if (usersUnsubscribe) {
            realTimeSubscriptions.push(usersUnsubscribe);
        }
        
        // Subscribe to settings updates
        const settingsUnsubscribe = SettingsService.setupRealtimeUpdates((settings) => {
            if (currentTab === 'settings') {
                renderSettings(settings);
            }
        });
        
        if (settingsUnsubscribe) {
            realTimeSubscriptions.push(settingsUnsubscribe);
        }
    }
    
    /**
     * Load initial data
     */
    async function loadInitialData() {
        try {
            console.log('📊 جاري تحميل البيانات الأولية...');
            
            // Load dashboard data
            await loadDashboard();
            
            // Load settings
            await SettingsService.loadSettings();
            
            // Apply theme
            const theme = SettingsService.getSetting('theme');
            if (theme) {
                SettingsService.applyTheme(theme);
            }
            
            console.log('✅ تم تحميل البيانات الأولية');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات الأولية:', error);
            throw error;
        }
    }
    
    /**
     * Load data for specific tab
     */
    async function loadTabData(tabId) {
        try {
            switch (tabId) {
                case 'dashboard':
                    await loadDashboard();
                    break;
                case 'products':
                    await loadProducts();
                    break;
                case 'orders':
                    await loadOrders();
                    break;
                case 'users':
                    await loadUsers();
                    break;
                case 'settings':
                    await loadSettings();
                    break;
            }
        } catch (error) {
            console.error(`❌ خطأ في تحميل بيانات التبويب ${tabId}:`, error);
            UIHelpers.showToast(`خطأ في تحميل البيانات: ${error.message}`, 'error');
        }
    }
    
    /**
     * Load dashboard data
     */
    async function loadDashboard() {
        try {
            console.log('📈 جاري تحميل لوحة الإحصائيات...');
            
            const loadingId = UIHelpers.showLoading('dashboard');
            
            // Get statistics from all services
            const [productStats, orderStats, userStats] = await Promise.all([
                ProductService.getProductStats(),
                OrderService.getOrderStats(),
                UserService.getUserStats()
            ]);
            
            // Render statistics
            renderStats({
                products: productStats,
                orders: orderStats,
                users: userStats
            });
            
            UIHelpers.hideLoading(loadingId);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الإحصائيات:', error);
            throw error;
        }
    }
    
    /**
     * Load products
     */
    async function loadProducts(filters = {}, page = 1) {
        try {
            console.log('📦 جاري تحميل المنتجات...');
            
            const loadingId = UIHelpers.showLoading('products');
            
            const result = await ProductService.getProducts(filters, page);
            
            // Render products
            renderProducts(result.products, result.pagination);
            
            UIHelpers.hideLoading(loadingId);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل المنتجات:', error);
            throw error;
        }
    }
    
    /**
     * Load orders
     */
    async function loadOrders(filters = {}, page = 1) {
        try {
            console.log('🛒 جاري تحميل الطلبات...');
            
            const loadingId = UIHelpers.showLoading('orders');
            
            const result = await OrderService.getOrders(filters, page);
            
            // Render orders
            renderOrders(result.orders, result.pagination);
            
            UIHelpers.hideLoading(loadingId);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الطلبات:', error);
            throw error;
        }
    }
    
    /**
     * Load users
     */
    async function loadUsers(filters = {}, page = 1) {
        try {
            console.log('👥 جاري تحميل المستخدمين...');
            
            const loadingId = UIHelpers.showLoading('users');
            
            const result = await UserService.getUsers(filters, page);
            
            // Render users
            renderUsers(result.users, result.pagination);
            
            UIHelpers.hideLoading(loadingId);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل المستخدمين:', error);
            throw error;
        }
    }
    
    /**
     * Load settings
     */
    async function loadSettings() {
        try {
            console.log('⚙️ جاري تحميل الإعدادات...');
            
            const loadingId = UIHelpers.showLoading('settings');
            
            const settings = await SettingsService.loadSettings();
            
            // Render settings
            renderSettings(settings);
            
            UIHelpers.hideLoading(loadingId);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الإعدادات:', error);
            throw error;
        }
    }
    
    /**
     * Render statistics
     */
    function renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        if (!statsGrid) return;
        
        const html = `
            <div class="stat-card">
                <div class="stat-icon" style="background: #e3f2fd; color: #1976d2;">
                    <i class="fas fa-box"></i>
                </div>
                <div class="stat-value">${UIHelpers.formatNumber(stats.products.totalProducts)}</div>
                <div class="stat-label">إجمالي المنتجات</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    ${UIHelpers.formatNumber(stats.products.activeProducts)} نشط
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: #f3e5f5; color: #7b1fa2;">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="stat-value">${UIHelpers.formatNumber(stats.orders.totalOrders)}</div>
                <div class="stat-label">إجمالي الطلبات</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    ${UIHelpers.formatNumber(stats.orders.pendingOrders)} قيد الانتظار
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: #e8f5e9; color: #388e3c;">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-value">${UIHelpers.formatNumber(stats.users.totalUsers)}</div>
                <div class="stat-label">إجمالي المستخدمين</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    ${UIHelpers.formatNumber(stats.users.activeUsers)} نشط
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon" style="background: #fff3e0; color: #f57c00;">
                    <i class="fas fa-wallet"></i>
                </div>
                <div class="stat-value">${UIHelpers.formatPrice(stats.orders.totalRevenue)}</div>
                <div class="stat-label">إجمالي المبيعات</div>
                <div class="stat-change positive">
                    <i class="fas fa-arrow-up"></i>
                    ${UIHelpers.formatPrice(stats.orders.averageOrderValue)} متوسط الطلب
                </div>
            </div>
        `;
        
        statsGrid.innerHTML = html;
    }
    
    /**
     * Render products
     */
    function renderProducts(products, pagination) {
        const productsGrid = document.getElementById('productsGrid');
        const paginationContainer = document.getElementById('productsPagination');
        
        if (!productsGrid) return;
        
        if (!products || products.length === 0) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open fa-3x"></i>
                    <h3>لا توجد منتجات</h3>
                    <p>قم بإضافة منتج جديد للبدء</p>
                    <button class="btn btn-primary" onclick="ProductModal.openAddModal()">
                        <i class="fas fa-plus"></i>
                        إضافة منتج جديد
                    </button>
                </div>
            `;
            return;
        }
        
        // Render products grid
        let html = '';
        
        products.forEach(product => {
            const isActive = product.isActive !== false;
            const stockStatus = getStockStatus(product.stock);
            
            html += `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-image-container">
                        <img src="${product.image || 'assets/default-product.png'}" 
                             alt="${product.name}"
                             class="product-image"
                             onerror="this.src='assets/default-product.png'">
                        
                        <div class="product-badges">
                            ${!isActive ? '<span class="product-badge badge-inactive">غير نشط</span>' : ''}
                            ${product.isNew ? '<span class="product-badge badge-new">جديد</span>' : ''}
                            ${product.isSale ? '<span class="product-badge badge-sale">عرض</span>' : ''}
                            ${product.isBest ? '<span class="product-badge badge-best">الأفضل</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="product-content">
                        <h3 class="product-title">${UIHelpers.escapeHtml(product.name)}</h3>
                        
                        <span class="product-category">
                            ${AppConstants.PRODUCT_CATEGORIES[product.category] || product.category}
                        </span>
                        
                        <div class="product-price">
                            ${UIHelpers.formatPrice(product.price)}
                        </div>
                        
                        <div class="product-stock ${stockStatus.class}">
                            <i class="fas fa-box"></i>
                            ${product.stock || 0} قطعة
                        </div>
                        
                        <div class="product-actions">
                            <button class="btn btn-secondary btn-sm" onclick="editProduct('${product.id}')">
                                <i class="fas fa-edit"></i>
                                تعديل
                            </button>
                            <button class="btn ${isActive ? 'btn-danger' : 'btn-success'} btn-sm" 
                                    onclick="toggleProductStatus('${product.id}', ${!isActive})">
                                <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
                                ${isActive ? 'تعطيل' : 'تفعيل'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        productsGrid.innerHTML = html;
        
        // Render pagination
        if (pagination && paginationContainer) {
            if (pagination.totalPages > 1) {
                const paginationHtml = UIHelpers.createPagination(
                    pagination.currentPage,
                    pagination.totalPages,
                    (page) => loadProducts({}, page)
                );
                paginationContainer.innerHTML = '';
                paginationContainer.appendChild(paginationHtml);
            } else {
                paginationContainer.innerHTML = '';
            }
        }
    }
    
    /**
     * Render orders
     */
    function renderOrders(orders, pagination) {
        const ordersList = document.getElementById('ordersList');
        const paginationContainer = document.getElementById('ordersPagination');
        
        if (!ordersList) return;
        
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-basket fa-3x"></i>
                    <h3>لا توجد طلبات</h3>
                    <p>لم يتم تقديم أي طلبات حتى الآن</p>
                </div>
            `;
            return;
        }
        
        // Render orders list
        let html = '';
        
        orders.forEach(order => {
            const statusLabel = AppConstants.ORDER_STATUS_LABELS[order.status] || order.status;
            const statusColor = AppConstants.ORDER_STATUS_COLORS[order.status] || '#ddd';
            
            html += `
                <div class="order-card" data-id="${order.id}">
                    <div class="order-header">
                        <div>
                            <div class="order-id">طلب ${order.orderNumber}</div>
                            <div class="order-date">${UIHelpers.formatDate(order.createdAt)}</div>
                        </div>
                        <span class="order-status" style="background: ${statusColor}">
                            ${statusLabel}
                        </span>
                    </div>
                    
                    <div class="order-body">
                        <div class="order-customer">
                            <h4 class="order-section-title">معلومات العميل</h4>
                            <p><strong>الاسم:</strong> ${order.customer?.name || 'غير محدد'}</p>
                            <p><strong>الهاتف:</strong> ${order.customer?.phone || 'غير محدد'}</p>
                            <p><strong>البريد:</strong> ${order.customer?.email || 'غير محدد'}</p>
                            <p><strong>العنوان:</strong> ${order.customer?.address || 'غير محدد'}</p>
                        </div>
                        
                        <div class="order-summary">
                            <h4 class="order-section-title">ملخص الطلب</h4>
                            <div class="order-items">
                                ${order.items?.map(item => `
                                    <div class="order-item">
                                        <span class="item-name">${item.name}</span>
                                        <span class="item-quantity">× ${item.quantity}</span>
                                        <span class="item-price">${UIHelpers.formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                `).join('') || ''}
                            </div>
                            <div class="order-total">
                                الإجمالي: ${UIHelpers.formatPrice(order.total)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="order-footer">
                        <div class="order-actions">
                            <select class="form-control" onchange="updateOrderStatus('${order.id}', this.value)">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                                <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>مؤكد</option>
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>قيد التجهيز</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>تم التوصيل</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                            </select>
                            
                            <button class="btn btn-secondary btn-sm" onclick="printOrderInvoice('${order.id}')">
                                <i class="fas fa-print"></i>
                                طباعة
                            </button>
                            
                            <button class="btn btn-danger btn-sm" onclick="deleteOrder('${order.id}')">
                                <i class="fas fa-trash"></i>
                                حذف
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        ordersList.innerHTML = html;
        
        // Render pagination
        if (pagination && paginationContainer) {
            if (pagination.totalPages > 1) {
                const paginationHtml = UIHelpers.createPagination(
                    pagination.currentPage,
                    pagination.totalPages,
                    (page) => loadOrders({}, page)
                );
                paginationContainer.innerHTML = '';
                paginationContainer.appendChild(paginationHtml);
            } else {
                paginationContainer.innerHTML = '';
            }
        }
    }
    
    /**
     * Render users
     */
    function renderUsers(users, pagination) {
        const usersList = document.getElementById('usersList');
        
        if (!usersList) return;
        
        if (!users || users.length === 0) {
            usersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users fa-3x"></i>
                    <h3>لا يوجد مستخدمين</h3>
                    <p>لم يتم تسجيل أي مستخدمين حتى الآن</p>
                </div>
            `;
            return;
        }
        
        // Render users list
        let html = '';
        
        users.forEach(user => {
            const isActive = user.isActive !== false;
            const roleLabel = getRoleLabel(user.role);
            
            html += `
                <div class="user-card" data-id="${user.id}">
                    <div class="user-header">
                        <img src="${user.photoURL || 'assets/default-avatar.png'}" 
                             alt="${user.name}"
                             class="user-avatar"
                             onerror="this.src='assets/default-avatar.png'">
                        
                        <div class="user-info">
                            <h3>${UIHelpers.escapeHtml(user.name || 'بدون اسم')}</h3>
                            <p class="user-email">${user.email || 'بدون بريد'}</p>
                            <span class="user-role role-${user.role || 'user'}">
                                ${roleLabel}
                            </span>
                        </div>
                    </div>
                    
                    <div class="user-stats">
                        <div class="stat-item">
                            <span class="stat-value">${user.totalOrders || 0}</span>
                            <span class="stat-label">الطلبات</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${UIHelpers.formatPrice(user.totalSpent || 0)}</span>
                            <span class="stat-label">إجمالي المشتريات</span>
                        </div>
                    </div>
                    
                    <div class="user-joined">
                        <i class="fas fa-calendar-alt"></i>
                        انضم في ${UIHelpers.formatDate(user.createdAt, 'short')}
                    </div>
                    
                    <div class="user-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn btn-secondary btn-sm" onclick="editUser('${user.id}')">
                            <i class="fas fa-edit"></i>
                            تعديل
                        </button>
                        <button class="btn ${isActive ? 'btn-danger' : 'btn-success'} btn-sm" 
                                onclick="toggleUserStatus('${user.id}', ${!isActive})">
                            <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
                            ${isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                    </div>
                </div>
            `;
        });
        
        usersList.innerHTML = html;
    }
    
    /**
     * Render settings
     */
    function renderSettings(settings) {
        const settingsContent = document.getElementById('settingsContent');
        if (!settingsContent) return;
        
        // This is a simplified version. You'll need to implement full settings rendering
        const html = `
            <div class="settings-section">
                <h3><i class="fas fa-store"></i> إعدادات المتجر</h3>
                
                <div class="form-group">
                    <label class="form-label">اسم المتجر</label>
                    <input type="text" class="form-control" id="storeName" 
                           value="${settings.storeName || ''}" 
                           placeholder="أدخل اسم المتجر">
                </div>
                
                <div class="form-group">
                    <label class="form-label">البريد الإلكتروني</label>
                    <input type="email" class="form-control" id="storeEmail" 
                           value="${settings.storeEmail || ''}" 
                           placeholder="أدخل البريد الإلكتروني">
                </div>
                
                <div class="form-group">
                    <label class="form-label">رقم الهاتف</label>
                    <input type="tel" class="form-control" id="storePhone" 
                           value="${settings.storePhone || ''}" 
                           placeholder="أدخل رقم الهاتف">
                </div>
                
                <div class="form-group">
                    <label class="form-label">العنوان</label>
                    <textarea class="form-control" id="storeAddress" rows="3"
                              placeholder="أدخل عنوان المتجر">${settings.storeAddress || ''}</textarea>
                </div>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-truck"></i> إعدادات الشحن</h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">تكلفة الشحن (${AppConstants.CURRENCY})</label>
                        <input type="number" class="form-control" id="shippingCost" 
                               value="${settings.shippingCost || 0}" min="0" step="0.01">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">التوصيل المجاني من (${AppConstants.CURRENCY})</label>
                        <input type="number" class="form-control" id="freeShippingThreshold" 
                               value="${settings.freeShippingThreshold || 0}" min="0">
                    </div>
                </div>
            </div>
        `;
        
        settingsContent.innerHTML = html;
    }
    
    /**
     * Update product badge with new products count
     */
    function updateProductBadge(products) {
        const productsBadge = document.getElementById('productsBadge');
        if (!productsBadge) return;
        
        const newProducts = products.filter(p => p.isNew).length;
        
        if (newProducts > 0) {
            productsBadge.textContent = newProducts;
            productsBadge.classList.remove('hidden');
        } else {
            productsBadge.classList.add('hidden');
        }
    }
    
    /**
     * Update order badge with pending orders count
     */
    function updateOrderBadge(orders) {
        const ordersBadge = document.getElementById('ordersBadge');
        if (!ordersBadge) return;
        
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        
        if (pendingOrders > 0) {
            ordersBadge.textContent = pendingOrders;
            ordersBadge.classList.remove('hidden');
        } else {
            ordersBadge.classList.add('hidden');
        }
    }
    
    /**
     * Get stock status
     */
    function getStockStatus(stock) {
        if (stock <= 0) {
            return { class: 'stock-low', text: 'نفذ من المخزون' };
        } else if (stock <= 10) {
            return { class: 'stock-medium', text: 'كمية محدودة' };
        } else {
            return { class: 'stock-high', text: 'متوفر' };
        }
    }
    
    /**
     * Get role label
     */
    function getRoleLabel(role) {
        switch (role) {
            case 'admin': return 'مسؤول';
            case 'manager': return 'مدير';
            case 'editor': return 'محرر';
            case 'viewer': return 'مشاهد';
            default: return 'مستخدم';
        }
    }
    
    /**
     * Update connection status
     */
    function updateConnectionStatus() {
        const connectionStatus = document.getElementById('connectionStatus');
        if (!connectionStatus) return;
        
        // Simulate connection check
        const isOnline = navigator.onLine;
        
        if (isOnline) {
            connectionStatus.innerHTML = '<i class="fas fa-circle"></i> متصل';
            connectionStatus.className = 'status-online';
        } else {
            connectionStatus.innerHTML = '<i class="fas fa-circle"></i> غير متصل';
            connectionStatus.className = 'status-offline';
        }
        
        // Update periodically
        setTimeout(updateConnectionStatus, 30000);
    }
    
    /**
     * Refresh current tab
     */
    async function refreshCurrentTab() {
        try {
            await loadTabData(currentTab);
            UIHelpers.showToast('تم تحديث البيانات', 'success');
        } catch (error) {
            console.error('❌ خطأ في تحديث البيانات:', error);
            UIHelpers.showToast('خطأ في تحديث البيانات', 'error');
        }
    }
    
    /**
     * Save current tab
     */
    async function saveCurrentTab() {
        try {
            switch (currentTab) {
                case 'settings':
                    await SettingsService.saveAllSettings();
                    break;
                default:
                    UIHelpers.showToast('لا يوجد شيء للحفظ في هذا التبويب', 'info');
            }
        } catch (error) {
            console.error('❌ خطأ في حفظ البيانات:', error);
            UIHelpers.showToast('خطأ في حفظ البيانات', 'error');
        }
    }
    
    /**
     * Handle export
     */
    async function handleExport(button) {
        try {
            const exportType = button.dataset.exportType || 'csv';
            
            switch (currentTab) {
                case 'products':
                    await ProductService.exportProducts(exportType);
                    break;
                case 'orders':
                    await OrderService.exportOrders(exportType);
                    break;
                case 'users':
                    await UserService.exportUsers(exportType);
                    break;
                default:
                    UIHelpers.showToast('لا يمكن التصدير من هذا التبويب', 'warning');
            }
        } catch (error) {
            console.error('❌ خطأ في التصدير:', error);
            UIHelpers.showToast('خطأ في التصدير', 'error');
        }
    }
    
    /**
     * Handle print
     */
    function handlePrint(button) {
        const printType = button.dataset.printType;
        
        switch (printType) {
            case 'invoice':
                // Handle invoice printing
                break;
            case 'report':
                // Handle report printing
                break;
            default:
                window.print();
        }
    }
    
    /**
     * Focus search input
     */
    function focusSearch() {
        let searchInput = null;
        
        switch (currentTab) {
            case 'products':
                searchInput = document.getElementById('productSearch');
                break;
            case 'orders':
                searchInput = document.getElementById('orderSearch');
                break;
            case 'users':
                searchInput = document.getElementById('userSearch');
                break;
        }
        
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    /**
     * Close all modals
     */
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    /**
     * Show error page
     */
    function showErrorPage(error) {
        const appContainer = document.getElementById('appContainer');
        const loadingScreen = document.getElementById('loadingScreen');
        
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #e74c3c; margin-bottom: 20px;"></i>
                    <h1 style="color: #e74c3c; margin-bottom: 20px;">حدث خطأ</h1>
                    <p style="margin-bottom: 20px; color: #666;">${error.message || 'خطأ غير معروف'}</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="location.reload()" class="btn btn-primary">
                            <i class="fas fa-redo"></i>
                            إعادة المحاولة
                        </button>
                        <button onclick="window.location.href='index.html'" class="btn btn-secondary">
                            <i class="fas fa-home"></i>
                            العودة للصفحة الرئيسية
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        // Unsubscribe from all real-time updates
        realTimeSubscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        
        realTimeSubscriptions = [];
        
        // Clean up services
        ProductService.cleanup();
        OrderService.cleanup();
        UserService.cleanup();
        SettingsService.cleanup();
        
        console.log('🧹 تم تنظيف الموارد');
    }
    
    // Public API
    return {
        init,
        refreshCurrentTab,
        saveCurrentTab,
        cleanup
    };
})();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    AdminApp.cleanup();
});

// Export for debugging
window.AdminApp = AdminApp;

// Global functions (for use in HTML onclick attributes)
window.editProduct = async function(productId) {
    try {
        // Open product edit modal
        console.log(`✏️ تحرير المنتج: ${productId}`);
        // Implement product edit modal
    } catch (error) {
        console.error('❌ خطأ في فتح نموذج التحرير:', error);
        UIHelpers.showToast('خطأ في فتح نموذج التحرير', 'error');
    }
};

window.toggleProductStatus = async function(productId, isActive) {
    try {
        const confirmed = await UIHelpers.confirm({
            title: isActive ? 'تفعيل المنتج' : 'تعطيل المنتج',
            message: `هل أنت متأكد من ${isActive ? 'تفعيل' : 'تعطيل'} هذا المنتج؟`
        });
        
        if (confirmed) {
            await ProductService.toggleProductStatus(productId, isActive);
        }
    } catch (error) {
        console.error('❌ خطأ في تغيير حالة المنتج:', error);
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        await OrderService.updateOrderStatus(orderId, newStatus);
    } catch (error) {
        console.error('❌ خطأ في تحديث حالة الطلب:', error);
    }
};

window.printOrderInvoice = async function(orderId) {
    try {
        await OrderService.printOrderInvoice(orderId);
    } catch (error) {
        console.error('❌ خطأ في طباعة الفاتورة:', error);
    }
};

window.deleteOrder = async function(orderId) {
    try {
        const confirmed = await UIHelpers.confirm({
            title: 'حذف الطلب',
            message: 'هل أنت متأكد من حذف هذا الطلب؟ هذا الإجراء لا يمكن التراجع عنه.'
        });
        
        if (confirmed) {
            await OrderService.deleteOrder(orderId);
        }
    } catch (error) {
        console.error('❌ خطأ في حذف الطلب:', error);
    }
};

window.editUser = async function(userId) {
    try {
        // Open user edit modal
        console.log(`✏️ تحرير المستخدم: ${userId}`);
        // Implement user edit modal
    } catch (error) {
        console.error('❌ خطأ في فتح نموذج تحرير المستخدم:', error);
        UIHelpers.showToast('خطأ في فتح نموذج تحرير المستخدم', 'error');
    }
};

window.toggleUserStatus = async function(userId, isActive) {
    try {
        const confirmed = await UIHelpers.confirm({
            title: isActive ? 'تفعيل المستخدم' : 'تعطيل المستخدم',
            message: `هل أنت متأكد من ${isActive ? 'تفعيل' : 'تعطيل'} هذا المستخدم؟`
        });
        
        if (confirmed) {
            await UserService.updateUserStatus(userId, isActive);
        }
    } catch (error) {
        console.error('❌ خطأ في تغيير حالة المستخدم:', error);
    }
};

// Logout function
window.logout = async function() {
    try {
        const confirmed = await UIHelpers.confirm({
            title: 'تسجيل الخروج',
            message: 'هل أنت متأكد من تسجيل الخروج؟'
        });
        
        if (confirmed) {
            await FirebaseService.signOut();
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج:', error);
        UIHelpers.showToast('خطأ في تسجيل الخروج', 'error');
    }
};

// Go to store
window.goToStore = function() {
    window.open('index.html', '_blank');
};

// Product Modal (simplified version)
window.ProductModal = {
    openAddModal: function() {
        // Open add product modal
        console.log('➕ فتح نموذج إضافة منتج');
        // Implement add product modal
    },
    
    openEditModal: function(productId) {
        // Open edit product modal
        console.log(`✏️ فتح نموذج تحرير المنتج: ${productId}`);
        // Implement edit product modal
    }
};


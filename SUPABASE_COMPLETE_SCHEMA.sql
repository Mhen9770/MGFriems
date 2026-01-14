-- Complete Factory Management System - Comprehensive Database Schema
-- Run this in your Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For better search

-- ==================== CORE TABLES ====================

-- Users/Managers Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'manager',
    cash_balance DECIMAL(12, 2) DEFAULT 0.00,
    permissions JSONB DEFAULT '{"all": true}'::jsonb,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstin TEXT,
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    current_outstanding DECIMAL(12, 2) DEFAULT 0,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products/Items Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT NOT NULL, -- kg, pcs, liters, etc
    selling_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2),
    tax_rate DECIMAL(5, 2) DEFAULT 0, -- GST percentage
    reorder_level DECIMAL(12, 2) DEFAULT 0,
    current_stock DECIMAL(12, 2) DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS bom (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    raw_material_id UUID REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_required DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Orders
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    order_date DATE DEFAULT CURRENT_DATE,
    delivery_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'ready', 'delivered', 'cancelled')),
    items JSONB NOT NULL, -- [{product_id, product_name, quantity, unit_price, tax_amount, total}]
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit', 'partial')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    collected_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi', 'card')),
    payment_date DATE DEFAULT CURRENT_DATE,
    reference_number TEXT,
    collected_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Orders
CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_number TEXT UNIQUE NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id),
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity_planned DECIMAL(12, 2) NOT NULL,
    quantity_produced DECIMAL(12, 2) DEFAULT 0,
    quantity_rejected DECIMAL(12, 2) DEFAULT 0,
    unit TEXT NOT NULL,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'quality_check', 'completed', 'on_hold')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    start_date DATE,
    end_date DATE,
    completion_date DATE,
    raw_materials_consumed JSONB, -- [{material_id, material_name, quantity_used}]
    workers_assigned JSONB, -- [{worker_id, worker_name, hours}]
    machines_used JSONB, -- [{machine_name, hours}]
    production_cost DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality Checkpoints
CREATE TABLE IF NOT EXISTS quality_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE,
    checkpoint_name TEXT NOT NULL,
    status TEXT CHECK (status IN ('passed', 'failed', 'pending')),
    checked_by UUID REFERENCES users(id),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    images JSONB -- Array of image URLs
);

-- Raw Materials Inventory
CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code TEXT UNIQUE NOT NULL,
    material_name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    current_stock DECIMAL(12, 2) DEFAULT 0,
    reorder_level DECIMAL(12, 2) DEFAULT 0,
    max_stock_level DECIMAL(12, 2),
    unit_price DECIMAL(12, 2) NOT NULL,
    location TEXT,
    supplier_id UUID REFERENCES suppliers(id),
    last_purchase_date DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    gstin TEXT,
    payment_terms TEXT,
    total_purchases DECIMAL(12, 2) DEFAULT 0,
    current_outstanding DECIMAL(12, 2) DEFAULT 0,
    rating DECIMAL(2, 1) DEFAULT 0, -- 0-5 stars
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'received', 'cancelled')),
    items JSONB NOT NULL, -- [{material_id, material_name, quantity, unit_price, total}]
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES raw_materials(id),
    product_id UUID REFERENCES products(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity DECIMAL(12, 2) NOT NULL,
    reference_type TEXT, -- 'purchase', 'production', 'sale', 'adjustment'
    reference_id UUID,
    from_location TEXT,
    to_location TEXT,
    notes TEXT,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'utilities', 'salaries', 'rent', 'maintenance', 'transport', 'other'
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    payment_method TEXT,
    paid_to TEXT,
    invoice_number TEXT,
    is_recurring BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees/Workers
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    designation TEXT,
    department TEXT,
    date_of_joining DATE,
    salary DECIMAL(12, 2),
    payment_frequency TEXT CHECK (payment_frequency IN ('daily', 'weekly', 'monthly')),
    bank_account TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
    check_in_time TIME,
    check_out_time TIME,
    hours_worked DECIMAL(4, 2),
    overtime_hours DECIMAL(4, 2) DEFAULT 0,
    notes TEXT,
    marked_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- Salary Payments
CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    payment_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    overtime_amount DECIMAL(12, 2) DEFAULT 0,
    bonus DECIMAL(12, 2) DEFAULT 0,
    deductions DECIMAL(12, 2) DEFAULT 0,
    net_salary DECIMAL(12, 2) NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    notes TEXT,
    paid_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash Transfers (Partnership System)
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    from_user_name TEXT NOT NULL,
    to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    to_user_name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT, -- 'transfer', 'low_stock', 'payment_due', 'production', etc
    reference_type TEXT,
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_product ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON raw_materials USING gin(material_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_stock_movements_material ON stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ==================== FUNCTIONS ====================

-- Auto-generate codes
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM customers;
    RETURN 'CUST-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM sales_orders;
    RETURN 'SO-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_production_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM production_orders;
    RETURN 'PROD-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM payments;
    RETURN 'PAY-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM purchase_orders;
    RETURN 'PO-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM expenses;
    RETURN 'EXP-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Handle payment and update cash balance
CREATE OR REPLACE FUNCTION handle_payment_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Update order paid amount and payment status
    UPDATE sales_orders 
    SET 
        paid_amount = paid_amount + NEW.amount,
        payment_status = CASE 
            WHEN (paid_amount + NEW.amount) >= total_amount THEN 'paid'
            WHEN (paid_amount + NEW.amount) > 0 THEN 'partial'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
    -- Update customer outstanding
    UPDATE customers
    SET current_outstanding = current_outstanding - NEW.amount
    WHERE id = NEW.customer_id;
    
    -- Update manager cash balance
    UPDATE users
    SET cash_balance = cash_balance + NEW.amount
    WHERE id = NEW.collected_by;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_created
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_payment_creation();

-- Handle transfer approval
CREATE OR REPLACE FUNCTION handle_transfer_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Decrease sender's balance
        UPDATE users 
        SET cash_balance = cash_balance - NEW.amount
        WHERE id = NEW.from_user_id;
        
        -- Increase receiver's balance
        UPDATE users 
        SET cash_balance = cash_balance + NEW.amount
        WHERE id = NEW.to_user_id;
        
        -- Create notification for sender
        INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (
            NEW.from_user_id,
            'Transfer Approved',
            'Your transfer of ₹' || NEW.amount || ' to ' || NEW.to_user_name || ' has been approved',
            'transfer',
            'transfer_request',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_transfer_status_change
    AFTER UPDATE ON transfer_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_transfer_approval();

-- Update product stock on stock movement
CREATE OR REPLACE FUNCTION handle_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movement_type = 'in' THEN
        IF NEW.material_id IS NOT NULL THEN
            UPDATE raw_materials 
            SET current_stock = current_stock + NEW.quantity
            WHERE id = NEW.material_id;
        END IF;
        IF NEW.product_id IS NOT NULL THEN
            UPDATE products 
            SET current_stock = current_stock + NEW.quantity
            WHERE id = NEW.product_id;
        END IF;
    ELSIF NEW.movement_type = 'out' THEN
        IF NEW.material_id IS NOT NULL THEN
            UPDATE raw_materials 
            SET current_stock = current_stock - NEW.quantity
            WHERE id = NEW.material_id;
        END IF;
        IF NEW.product_id IS NOT NULL THEN
            UPDATE products 
            SET current_stock = current_stock - NEW.quantity
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_stock_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION handle_stock_movement();

-- Create low stock notifications
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_stock <= NEW.reorder_level THEN
        INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
        SELECT 
            u.id,
            'Low Stock Alert',
            NEW.material_name || ' stock is low. Current: ' || NEW.current_stock || ' ' || NEW.unit,
            'low_stock',
            'raw_material',
            NEW.id
        FROM users u WHERE u.role = 'manager';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_raw_material_stock
    AFTER UPDATE ON raw_materials
    FOR EACH ROW
    EXECUTE FUNCTION check_low_stock();

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Allow authenticated users" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON sales_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON production_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON raw_materials FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON purchase_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON stock_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON employees FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can view their transfers" ON transfer_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can create transfers" ON transfer_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Recipients can update transfers" ON transfer_requests FOR UPDATE USING (auth.uid() = to_user_id);
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ==================== VIEWS FOR REPORTS ====================

-- Sales Summary View
CREATE OR REPLACE VIEW sales_summary AS
SELECT 
    DATE(order_date) as date,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_sales,
    SUM(paid_amount) as total_collected,
    SUM(total_amount - paid_amount) as outstanding
FROM sales_orders
GROUP BY DATE(order_date)
ORDER BY date DESC;

-- Production Summary View
CREATE OR REPLACE VIEW production_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_orders,
    SUM(quantity_planned) as total_planned,
    SUM(quantity_produced) as total_produced,
    SUM(quantity_rejected) as total_rejected
FROM production_orders
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Inventory Valuation View
CREATE OR REPLACE VIEW inventory_valuation AS
SELECT 
    'raw_material' as type,
    material_name as name,
    current_stock as stock,
    unit,
    unit_price,
    (current_stock * unit_price) as total_value
FROM raw_materials
UNION ALL
SELECT 
    'product' as type,
    name,
    current_stock as stock,
    unit,
    cost_price as unit_price,
    (current_stock * COALESCE(cost_price, 0)) as total_value
FROM products;

-- Top Customers View
CREATE OR REPLACE VIEW top_customers AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.city,
    COUNT(so.id) as total_orders,
    SUM(so.total_amount) as total_sales,
    c.current_outstanding
FROM customers c
LEFT JOIN sales_orders so ON c.id = so.customer_id
GROUP BY c.id, c.name, c.phone, c.city, c.current_outstanding
ORDER BY total_sales DESC
LIMIT 20;

-- ==================== INITIAL DATA ====================

-- Sample expense categories (can be modified)
-- Uncomment if you want default categories
-- INSERT INTO expense_categories (name) VALUES 
-- ('Utilities'), ('Salaries'), ('Rent'), ('Maintenance'), 
-- ('Transport'), ('Marketing'), ('Raw Materials'), ('Other')
-- ON CONFLICT DO NOTHING;

COMMENT ON TABLE customers IS 'Customer master data with credit management';
COMMENT ON TABLE products IS 'Product catalog with pricing and stock';
COMMENT ON TABLE sales_orders IS 'Sales orders/invoices with payment tracking';
COMMENT ON TABLE production_orders IS 'Production planning and tracking';
COMMENT ON TABLE raw_materials IS 'Raw material inventory management';
COMMENT ON TABLE employees IS 'Employee master data';
COMMENT ON TABLE attendance IS 'Daily attendance tracking';
COMMENT ON TABLE expenses IS 'Business expense tracking';
COMMENT ON TABLE transfer_requests IS 'Cash transfer between partners with approval';

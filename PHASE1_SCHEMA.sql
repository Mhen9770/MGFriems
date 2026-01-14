-- PHASE 1: Essential Factory Management - Database Schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CORE TABLES ====================

-- Users (Managers/Partners)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'manager',
    cash_balance DECIMAL(12, 2) DEFAULT 0.00,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    payment_terms TEXT DEFAULT 'cash', -- 'cash' or 'credit'
    credit_days INTEGER DEFAULT 0,
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    current_outstanding DECIMAL(12, 2) DEFAULT 0,
    total_purchases DECIMAL(12, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    selling_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) DEFAULT 0,
    current_stock DECIMAL(12, 2) DEFAULT 0,
    reorder_level DECIMAL(12, 2) DEFAULT 10,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packaging Materials (what's needed to pack products)
CREATE TABLE IF NOT EXISTS packaging_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_price DECIMAL(12, 2) NOT NULL,
    current_stock DECIMAL(12, 2) DEFAULT 0,
    reorder_level DECIMAL(12, 2) DEFAULT 10,
    supplier_id UUID REFERENCES suppliers(id),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Packaging Requirements (link products to packaging materials)
CREATE TABLE IF NOT EXISTS product_packaging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    packaging_material_id UUID REFERENCES packaging_materials(id) ON DELETE CASCADE,
    quantity_required DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, packaging_material_id)
);

-- Production Orders
CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_number TEXT UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity_planned DECIMAL(12, 2) NOT NULL,
    quantity_produced DECIMAL(12, 2) DEFAULT 0,
    quantity_rejected DECIMAL(12, 2) DEFAULT 0,
    unit TEXT NOT NULL,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    start_date DATE,
    end_date DATE,
    completion_date DATE,
    packaging_used JSONB DEFAULT '[]'::jsonb,
    production_cost DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    payment_terms TEXT DEFAULT 'cash', -- 'cash' or 'credit'
    credit_days INTEGER DEFAULT 0,
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    current_outstanding DECIMAL(12, 2) DEFAULT 0,
    total_sales DECIMAL(12, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Orders/Invoices
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    order_date DATE DEFAULT CURRENT_DATE,
    items JSONB NOT NULL, -- [{product_id, product_name, quantity, unit, unit_price, total}]
    subtotal DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    collected_by UUID REFERENCES users(id),
    collected_by_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (for credit sales)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number TEXT UNIQUE NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    payment_date DATE DEFAULT CURRENT_DATE,
    collected_by UUID REFERENCES users(id),
    collected_by_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash Transactions (all cash in/out)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'payment_received', 'purchase', 'expense', 'transfer_in', 'transfer_out')),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT, -- 'sales_order', 'payment', 'transfer', etc
    reference_id UUID,
    user_id UUID REFERENCES users(id),
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash Transfers (between partners)
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
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Supplier Purchases (track supplier payments)
CREATE TABLE IF NOT EXISTS supplier_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name TEXT NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    items JSONB NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    paid_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_production_orders_product ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_user ON cash_transactions(user_id);

-- ==================== FUNCTIONS ====================

-- Generate codes
CREATE OR REPLACE FUNCTION generate_supplier_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'SUP-' || LPAD((SELECT COUNT(*) + 1 FROM suppliers)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'PRD-' || LPAD((SELECT COUNT(*) + 1 FROM products)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_packaging_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'PKG-' || LPAD((SELECT COUNT(*) + 1 FROM packaging_materials)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_production_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'PROD-' || LPAD((SELECT COUNT(*) + 1 FROM production_orders)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'CUST-' || LPAD((SELECT COUNT(*) + 1 FROM customers)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || LPAD((SELECT COUNT(*) + 1 FROM sales_orders)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'PAY-' || LPAD((SELECT COUNT(*) + 1 FROM payments)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'PUR-' || LPAD((SELECT COUNT(*) + 1 FROM supplier_purchases)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'TXN-' || LPAD((SELECT COUNT(*) + 1 FROM cash_transactions)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suppliers_timestamp BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_timestamp BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_customers_timestamp BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sales_orders_timestamp BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_production_timestamp BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handle cash sale (auto add to cash balance & create transaction)
CREATE OR REPLACE FUNCTION handle_cash_sale()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_type = 'cash' THEN
        -- Update manager cash balance
        UPDATE users
        SET cash_balance = cash_balance + NEW.total_amount
        WHERE id = NEW.collected_by;
        
        -- Create cash transaction
        INSERT INTO cash_transactions (
            transaction_number,
            type,
            amount,
            description,
            reference_type,
            reference_id,
            user_id,
            user_name
        ) VALUES (
            generate_transaction_number(),
            'sale',
            NEW.total_amount,
            'Cash sale - ' || NEW.invoice_number || ' to ' || NEW.customer_name,
            'sales_order',
            NEW.id,
            NEW.collected_by,
            NEW.collected_by_name
        );
    ELSIF NEW.payment_type = 'credit' THEN
        -- Update customer outstanding
        UPDATE customers
        SET current_outstanding = current_outstanding + NEW.total_amount
        WHERE id = NEW.customer_id;
    END IF;
    
    -- Update customer total sales
    UPDATE customers
    SET total_sales = total_sales + NEW.total_amount
    WHERE id = NEW.customer_id;
    
    -- Reduce product stock
    DECLARE
        item JSONB;
    BEGIN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            UPDATE products
            SET current_stock = current_stock - (item->>'quantity')::DECIMAL
            WHERE id = (item->>'product_id')::UUID;
        END LOOP;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sales_order_created
    AFTER INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_cash_sale();

-- Handle payment received (credit payment)
CREATE OR REPLACE FUNCTION handle_payment_received()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sales order
    UPDATE sales_orders
    SET 
        paid_amount = paid_amount + NEW.amount,
        payment_status = CASE 
            WHEN (paid_amount + NEW.amount) >= total_amount THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = NEW.sales_order_id;
    
    -- Update customer outstanding
    UPDATE customers
    SET current_outstanding = current_outstanding - NEW.amount
    WHERE id = NEW.customer_id;
    
    -- Update manager cash balance
    UPDATE users
    SET cash_balance = cash_balance + NEW.amount
    WHERE id = NEW.collected_by;
    
    -- Create cash transaction
    INSERT INTO cash_transactions (
        transaction_number,
        type,
        amount,
        description,
        reference_type,
        reference_id,
        user_id,
        user_name
    ) VALUES (
        generate_transaction_number(),
        'payment_received',
        NEW.amount,
        'Payment received - ' || NEW.payment_number,
        'payment',
        NEW.id,
        NEW.collected_by,
        NEW.collected_by_name
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_created
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_payment_received();

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
        
        -- Create cash transactions
        INSERT INTO cash_transactions (
            transaction_number,
            type,
            amount,
            description,
            reference_type,
            reference_id,
            user_id,
            user_name
        ) VALUES (
            generate_transaction_number(),
            'transfer_out',
            NEW.amount,
            'Transfer to ' || NEW.to_user_name || ' - ' || NEW.reason,
            'transfer',
            NEW.id,
            NEW.from_user_id,
            NEW.from_user_name
        );
        
        INSERT INTO cash_transactions (
            transaction_number,
            type,
            amount,
            description,
            reference_type,
            reference_id,
            user_id,
            user_name
        ) VALUES (
            generate_transaction_number(),
            'transfer_in',
            NEW.amount,
            'Transfer from ' || NEW.from_user_name || ' - ' || NEW.reason,
            'transfer',
            NEW.id,
            NEW.to_user_id,
            NEW.to_user_name
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_transfer_approved
    AFTER UPDATE ON transfer_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_transfer_approval();

-- Handle production completion (add to product stock)
CREATE OR REPLACE FUNCTION handle_production_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Add produced quantity to product stock
        UPDATE products
        SET current_stock = current_stock + NEW.quantity_produced
        WHERE id = NEW.product_id;
        
        -- Deduct packaging materials
        DECLARE
            pkg JSONB;
        BEGIN
            FOR pkg IN SELECT * FROM jsonb_array_elements(NEW.packaging_used)
            LOOP
                UPDATE packaging_materials
                SET current_stock = current_stock - (pkg->>'quantity_used')::DECIMAL
                WHERE id = (pkg->>'material_id')::UUID;
            END LOOP;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_production_completed
    AFTER UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_production_completion();

-- Handle supplier purchase
CREATE OR REPLACE FUNCTION handle_supplier_purchase()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_type = 'cash' THEN
        -- Deduct from manager cash
        UPDATE users
        SET cash_balance = cash_balance - NEW.total_amount
        WHERE id = NEW.paid_by;
        
        -- Create cash transaction
        INSERT INTO cash_transactions (
            transaction_number,
            type,
            amount,
            description,
            reference_type,
            reference_id,
            user_id,
            user_name
        ) VALUES (
            generate_transaction_number(),
            'purchase',
            NEW.total_amount,
            'Purchase from ' || NEW.supplier_name || ' - ' || NEW.purchase_number,
            'supplier_purchase',
            NEW.id,
            NEW.paid_by,
            (SELECT name FROM users WHERE id = NEW.paid_by)
        );
    ELSIF NEW.payment_type = 'credit' THEN
        -- Add to supplier outstanding
        UPDATE suppliers
        SET current_outstanding = current_outstanding + NEW.total_amount
        WHERE id = NEW.supplier_id;
    END IF;
    
    -- Update supplier total purchases
    UPDATE suppliers
    SET total_purchases = total_purchases + NEW.total_amount
    WHERE id = NEW.supplier_id;
    
    -- Add packaging materials to stock
    DECLARE
        item JSONB;
    BEGIN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            UPDATE packaging_materials
            SET current_stock = current_stock + (item->>'quantity')::DECIMAL
            WHERE id = (item->>'material_id')::UUID;
        END LOOP;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_supplier_purchase_created
    AFTER INSERT ON supplier_purchases
    FOR EACH ROW
    EXECUTE FUNCTION handle_supplier_purchase();

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_purchases ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users
CREATE POLICY "Allow all for authenticated" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON packaging_materials FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON product_packaging FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON production_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON sales_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON cash_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON supplier_purchases FOR ALL USING (auth.role() = 'authenticated');

-- Transfer specific policies
CREATE POLICY "View own transfers" ON transfer_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Create own transfers" ON transfer_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Update received transfers" ON transfer_requests FOR UPDATE USING (auth.uid() = to_user_id);

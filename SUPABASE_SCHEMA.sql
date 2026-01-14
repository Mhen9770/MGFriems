-- Factory Management App - Complete Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== TABLES ====================

-- Users/Managers Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'manager',
    cash_balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    items JSONB NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'credit')),
    collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    collected_by_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'settled')),
    paid_amount DECIMAL(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Payments Table
CREATE TABLE IF NOT EXISTS credit_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    collected_by_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transfer Requests Table
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

-- Production Table
CREATE TABLE IF NOT EXISTS production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_number TEXT UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    raw_materials_used JSONB NOT NULL,
    workers JSONB NOT NULL,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Raw Materials Table
CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_name TEXT UNIQUE NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    supplier_name TEXT NOT NULL,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    added_by_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_sales_collected_by ON sales(collected_by);
CREATE INDEX IF NOT EXISTS idx_sales_payment_type ON sales(payment_type);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_from_user ON transfer_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_to_user ON transfer_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_production_created_by ON production(created_by);
CREATE INDEX IF NOT EXISTS idx_credit_payments_sale_id ON credit_payments(sale_id);

-- ==================== FUNCTIONS ====================

-- Function to auto-generate sale numbers
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM sales;
    RETURN 'SALE-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate production numbers
CREATE OR REPLACE FUNCTION generate_production_number()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO next_num FROM production;
    RETURN 'PROD-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update cash balance on sale creation
CREATE OR REPLACE FUNCTION handle_sale_cash_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_type = 'cash' THEN
        UPDATE users 
        SET cash_balance = cash_balance + NEW.total_amount
        WHERE id = NEW.collected_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update cash balance on credit payment
CREATE OR REPLACE FUNCTION handle_credit_payment_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user cash balance
    UPDATE users 
    SET cash_balance = cash_balance + NEW.amount
    WHERE id = NEW.collected_by;
    
    -- Update sale paid amount and status
    UPDATE sales 
    SET 
        paid_amount = paid_amount + NEW.amount,
        status = CASE 
            WHEN (paid_amount + NEW.amount) >= total_amount THEN 'settled'
            ELSE 'partial'
        END,
        updated_at = NOW()
    WHERE id = NEW.sale_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle transfer approval
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update raw material quantities
CREATE OR REPLACE FUNCTION handle_production_material_update()
RETURNS TRIGGER AS $$
DECLARE
    material JSONB;
BEGIN
    FOR material IN SELECT * FROM jsonb_array_elements(NEW.raw_materials_used)
    LOOP
        UPDATE raw_materials 
        SET quantity = quantity - (material->>'quantity_used')::DECIMAL
        WHERE material_name = material->>'material_name';
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

CREATE TRIGGER on_sale_created
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION handle_sale_cash_update();

CREATE TRIGGER on_credit_payment_created
    AFTER INSERT ON credit_payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_credit_payment_update();

CREATE TRIGGER on_transfer_approved
    AFTER UPDATE ON transfer_requests
    FOR EACH ROW
    EXECUTE FUNCTION handle_transfer_approval();

CREATE TRIGGER on_production_created
    AFTER INSERT ON production
    FOR EACH ROW
    EXECUTE FUNCTION handle_production_material_update();

-- ==================== ROW LEVEL SECURITY ====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE production ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all managers" ON users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Sales policies
CREATE POLICY "Authenticated users can view all sales" ON sales
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create sales" ON sales
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own sales" ON sales
    FOR UPDATE USING (collected_by = auth.uid());

-- Credit payments policies
CREATE POLICY "Authenticated users can view all credit payments" ON credit_payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create credit payments" ON credit_payments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Transfer requests policies
CREATE POLICY "Users can view their transfers" ON transfer_requests
    FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create transfer requests" ON transfer_requests
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipients can update transfers" ON transfer_requests
    FOR UPDATE USING (auth.uid() = to_user_id);

-- Production policies
CREATE POLICY "Authenticated users can view all production" ON production
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create production" ON production
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their production" ON production
    FOR UPDATE USING (created_by = auth.uid());

-- Raw materials policies
CREATE POLICY "Authenticated users can view all raw materials" ON raw_materials
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage raw materials" ON raw_materials
    FOR ALL USING (auth.role() = 'authenticated');

-- ==================== SEED DATA (OPTIONAL) ====================

-- You can add initial test data here if needed
-- Example:
-- INSERT INTO users (email, name, role, cash_balance) VALUES
-- ('manager1@factory.com', 'Manager One', 'manager', 0.00),
-- ('manager2@factory.com', 'Manager Two', 'manager', 0.00);

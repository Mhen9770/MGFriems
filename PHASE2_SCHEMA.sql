-- PHASE 2: Labor & Expenses Management - Additional Schema
-- Run this in Supabase SQL Editor (after PHASE1_SCHEMA.sql)

-- ==================== LABOR TABLES ====================

-- Workers/Laborers Profile
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    pay_type TEXT NOT NULL CHECK (pay_type IN ('daily', 'weekly', 'monthly', 'incentive')),
    base_rate DECIMAL(12, 2) NOT NULL, -- daily/weekly/monthly rate or per-packet rate for incentive
    pending_amount DECIMAL(12, 2) DEFAULT 0, -- amount owed to worker
    total_paid DECIMAL(12, 2) DEFAULT 0, -- total amount paid to worker
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Work Entries (track what work was done by each worker)
CREATE TABLE IF NOT EXISTS work_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number TEXT UNIQUE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    work_description TEXT NOT NULL,
    quantity DECIMAL(12, 2) DEFAULT 1, -- for incentive workers: packets done
    amount_earned DECIMAL(12, 2) NOT NULL, -- calculated based on pay_type
    is_paid BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Labor Payments (when paying workers)
CREATE TABLE IF NOT EXISTS labor_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number TEXT UNIQUE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_by UUID REFERENCES users(id), -- which partner paid
    paid_by_name TEXT NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== EXPENSES TABLE ====================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('utilities', 'raw_materials', 'maintenance', 'transport', 'miscellaneous')),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_by UUID REFERENCES users(id), -- which partner paid
    paid_by_name TEXT NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_workers_name ON workers(name);
CREATE INDEX IF NOT EXISTS idx_workers_pay_type ON workers(pay_type);
CREATE INDEX IF NOT EXISTS idx_work_entries_worker ON work_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_labor_payments_worker ON labor_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_labor_payments_date ON labor_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);

-- ==================== FUNCTIONS ====================

CREATE OR REPLACE FUNCTION generate_worker_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'WRK-' || LPAD((SELECT COUNT(*) + 1 FROM workers)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_work_entry_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'WE-' || LPAD((SELECT COUNT(*) + 1 FROM work_entries)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_labor_payment_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'LP-' || LPAD((SELECT COUNT(*) + 1 FROM labor_payments)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_expense_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'EXP-' || LPAD((SELECT COUNT(*) + 1 FROM expenses)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Update worker timestamps
CREATE TRIGGER update_workers_timestamp BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_expenses_timestamp BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handle work entry creation (add to worker pending amount)
CREATE OR REPLACE FUNCTION handle_work_entry_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Add earned amount to worker's pending balance
    UPDATE workers
    SET pending_amount = pending_amount + NEW.amount_earned
    WHERE id = NEW.worker_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_work_entry_created
    AFTER INSERT ON work_entries
    FOR EACH ROW
    EXECUTE FUNCTION handle_work_entry_created();

-- Handle labor payment (deduct from worker pending, add to partner cash)
CREATE OR REPLACE FUNCTION handle_labor_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update worker's pending amount and total paid
    UPDATE workers
    SET 
        pending_amount = pending_amount - NEW.amount,
        total_paid = total_paid + NEW.amount
    WHERE id = NEW.worker_id;
    
    -- Deduct from partner's cash balance
    UPDATE users
    SET cash_balance = cash_balance - NEW.amount
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
        'expense',
        NEW.amount,
        'Labor payment to ' || NEW.worker_name || ' - ' || NEW.payment_number,
        'labor_payment',
        NEW.id,
        NEW.paid_by,
        NEW.paid_by_name
    );
    
    -- Mark related work entries as paid
    UPDATE work_entries
    SET is_paid = true
    WHERE worker_id = NEW.worker_id AND is_paid = false;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_labor_payment_created
    AFTER INSERT ON labor_payments
    FOR EACH ROW
    EXECUTE FUNCTION handle_labor_payment();

-- Handle expense creation (deduct from partner cash)
CREATE OR REPLACE FUNCTION handle_expense_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct from partner's cash balance
    UPDATE users
    SET cash_balance = cash_balance - NEW.amount
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
        'expense',
        NEW.amount,
        NEW.category || ' expense - ' || NEW.description,
        'expense',
        NEW.id,
        NEW.paid_by,
        NEW.paid_by_name
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_expense_created
    AFTER INSERT ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION handle_expense_created();

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON workers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON work_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON labor_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON expenses FOR ALL USING (auth.role() = 'authenticated');

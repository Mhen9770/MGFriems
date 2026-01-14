# Factory Management App - Setup Instructions

## 🎯 Overview

This is a complete Factory Management Mobile App built with:
- **Frontend**: Expo (React Native)
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## 📋 Features

### ✅ Core Functionality
1. **Authentication** - JWT-based login/register for managers
2. **Dashboard** - Cash positions, pending approvals, quick actions
3. **Sales Management** - Create cash/credit bills, track payments
4. **Production Tracking** - Create production orders, track status
5. **Raw Materials** - Inventory management with low stock alerts
6. **Cash Transfer System** - Request & approve cash transfers between partners
7. **Partnership Trust** - Complete audit trail of all cash movements

### 🔐 Key Features
- Multi-manager support
- Cash balance tracking for each partner
- Transfer request & approval workflow
- Real-time balance updates
- Complete transaction history

## 🚀 Setup Instructions

### Step 1: Run the Database Schema

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the entire content from `/app/SUPABASE_SCHEMA.sql`
4. Paste it in the SQL editor
5. Click **Run** to execute

This will create:
- All database tables (users, sales, production, raw_materials, transfer_requests, credit_payments)
- Database functions for auto-numbering and cash management
- Triggers for automatic cash balance updates
- Row Level Security policies

### Step 2: Configure Email Settings (Optional but Recommended)

For production use, configure email authentication in Supabase:

1. Go to **Authentication** → **Email Templates**
2. Customize confirmation and password reset emails
3. Go to **Settings** → **Authentication** → **SMTP Settings**
4. Configure your SMTP provider (or use Supabase's default)

### Step 3: Test the App

The app is now ready to use! The environment variables are already configured in `/app/frontend/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://nqwgvcreaobhtjhsiygj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_skgUZeYlHYZbaCC2AqVTrA_6F8ACVL-
```

## 📱 Using the App

### First Time Setup

1. **Register Managers**: Each partner should register with their email and password
2. **Login**: Use registered credentials to login
3. **Start Using**: The app is ready!

### Main Workflows

#### 1. Recording a Sale (Cash/Credit)
1. Go to **Sales** tab
2. Click **+** button
3. Enter customer details and items
4. Select payment type (Cash or Credit)
5. Submit - Cash is automatically added to your balance

#### 2. Collecting Credit Payment
1. Go to **Sales** tab
2. Find the credit sale
3. Record payment - Cash balance updates automatically

#### 3. Transferring Cash Between Partners
1. Go to **Profile** tab
2. Click **Transfer Cash**
3. Select recipient partner
4. Enter amount and reason
5. Send request - Recipient gets notification on Dashboard

#### 4. Approving Cash Transfer
1. Check **Dashboard** for pending approvals
2. Review transfer details
3. **Approve** or **Reject**
4. Cash balances update automatically on approval

#### 5. Production Order
1. Go to **Production** tab
2. Click **+** button
3. Enter product details, quantity, workers
4. Submit order
5. Mark as completed when done

#### 6. Managing Raw Materials
1. Go to **Materials** tab
2. Click **+** button
3. Add material details (name, quantity, supplier, price)
4. Low stock alerts appear automatically

## 🔒 Security Features

### Row Level Security (RLS)
All tables have RLS enabled ensuring:
- Users can only see their own data or shared data
- Transfer approvals can only be done by recipients
- All data access is authenticated

### Authentication
- JWT tokens with 7-day expiration
- Secure password hashing
- Session management with AsyncStorage

## 📊 Partnership Trust System

### How It Works
1. **Transparent Balances**: All partners can see each other's cash positions
2. **Transfer Requests**: Partner A requests to transfer cash to Partner B
3. **Approval Required**: Partner B must approve before cash moves
4. **Audit Trail**: Complete history of all transfers with timestamps
5. **No Direct Transfers**: All transfers require two-party consent

### Why This Matters
- Prevents disputes about cash handling
- Clear accountability for each partner
- Automatic balance calculations
- Cannot manipulate balances without approval

## 🎨 App Structure

```
app/
├── (auth)/
│   ├── login.tsx          # Login screen
│   └── register.tsx       # Registration screen
├── (tabs)/
│   ├── dashboard.tsx      # Main dashboard
│   ├── sales.tsx          # Sales management
│   ├── production.tsx     # Production tracking
│   ├── materials.tsx      # Raw materials inventory
│   └── profile.tsx        # Profile & transfers
├── index.tsx              # Entry point
└── _layout.tsx            # Root layout

contexts/
└── AuthContext.tsx        # Authentication state

lib/
└── supabase.ts           # Supabase client config
```

## 🔧 Troubleshooting

### Email Confirmation Not Received
- Check Supabase Auth settings
- Disable email confirmation for development:
  - Go to **Authentication** → **Providers** → **Email**
  - Toggle **Confirm email** off

### Can't Login After Registration
- Check if email confirmation is required
- Verify Supabase credentials in `.env`
- Check Supabase logs in Dashboard

### Balance Not Updating
- Check Supabase SQL triggers are properly installed
- Verify RLS policies allow updates
- Refresh the screen (pull down to refresh)

### Transfer Not Appearing
- Ensure both users are registered as "managers"
- Check transfer_requests table in Supabase
- Verify RLS policies

## 📈 Scaling & Production

### For Production Use:
1. **Enable Email Verification** in Supabase Auth
2. **Add Service Role Key** for admin operations (optional)
3. **Configure SMTP** for email delivery
4. **Set up Supabase Backups** in project settings
5. **Monitor Usage** in Supabase dashboard

### Adding More Features:
- Reports & Analytics (by querying sales/production tables)
- Customer Management (add customers table)
- Employee Management (add employees table)
- Invoice Generation (use sales data)
- Expense Tracking (add expenses table)

## 💡 Tips

1. **Pull to Refresh**: All screens support pull-to-refresh
2. **Real-time Updates**: Balances update automatically
3. **Low Stock Alerts**: Materials below 10 units show warning
4. **Quick Actions**: Dashboard has shortcuts to common tasks
5. **Transaction History**: Profile shows recent transfers

## 🎯 Next Steps

The app is production-ready! Here's what you can do:

1. ✅ **Register all 5 partners** as managers
2. ✅ **Test cash transfers** between accounts
3. ✅ **Record some sample sales** (cash & credit)
4. ✅ **Add raw materials** inventory
5. ✅ **Create production orders**
6. ✅ **Test the approval workflow**

## 🆘 Support

If you encounter any issues:
1. Check Supabase logs in Dashboard
2. Verify all tables were created correctly
3. Ensure RLS policies are enabled
4. Test with simple operations first

---

**Built with ❤️ for Partnership Trust & Factory Management**

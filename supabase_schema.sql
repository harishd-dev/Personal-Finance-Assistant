-- Supabase PostgreSQL Schema with Row-Level Security (RLS)
-- AI Personal Finance Assistant Database

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    auth_provider TEXT,
    theme_preference TEXT DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create Policies for Profiles
CREATE POLICY "Users can view their own profile information" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile information" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);


-- 2. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Food', 'Utilities', 'Entertainment', 'Transportation', 'Shopping', 'Health', 'Education', 'Income', 'Other')),
    is_recurring BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'receipt', 'bank_statement')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Creating Policies for Transactions
CREATE POLICY "Users can access their own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);


-- 3. RECURRING BILLS TABLE
CREATE TABLE IF NOT EXISTS public.recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bill_name TEXT NOT NULL,
    current_cost NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    due_date TEXT NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Recurring Bills
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

-- Creating Policies for Recurring Bills
CREATE POLICY "Users can access their own recurring bills"
    ON public.recurring_bills FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring bills"
    ON public.recurring_bills FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring bills"
    ON public.recurring_bills FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring bills"
    ON public.recurring_bills FOR DELETE
    USING (auth.uid() = user_id);


-- 4. SAVINGS SUGGESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.savings_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bill_name TEXT NOT NULL,
    current_cost NUMERIC(12, 2) NOT NULL,
    suggested_action TEXT NOT NULL,
    expected_savings NUMERIC(12, 2) NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Savings Suggestions
ALTER TABLE public.savings_suggestions ENABLE ROW LEVEL SECURITY;

-- Creating Policies for Savings Suggestions
CREATE POLICY "Users can access their own savings suggestions"
    ON public.savings_suggestions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own savings suggestions"
    ON public.savings_suggestions FOR ALL
    USING (auth.uid() = user_id);


-- 5. TRIGGER FOR NEW USER REGISTRATION PROFILE CREATION
-- Automatically create a user profile in public.profiles when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'providers', 'email')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

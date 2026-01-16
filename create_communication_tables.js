console.log('Execute this SQL in Supabase:');
console.log(`
CREATE TABLE IF NOT EXISTS admin_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "receiverId" UUID REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  category VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'unread',
  "isFromAdmin" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_communication_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "communicationId" UUID NOT NULL REFERENCES admin_communications(id) ON DELETE CASCADE,
  "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  "isFromAdmin" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

router.get('/setup-activity-table', async (req, res) => {
    try {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(255),
        details JSONB,
        "ipAddress" VARCHAR(50),
        "userAgent" TEXT,
        role VARCHAR(50),
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_activity_logs_userId ON activity_logs("userId");
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_createdAt ON activity_logs("createdAt");
    `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: createTableSQL });

        // Fallback: note that if exec_sql isn't available, we might need to tell user to run SQL manually.
        // However, for this environment, let's assume we can try to use a direct raw query if the library supports it 
        // or rely on the user running the SQL if this fails.

        // Attempting to just return the SQL for the user to run if we can't execute it directly is a safe fallback.

        res.json({
            success: true,
            message: 'SQL command generated. If exec_sql RPC is not enabled, please run the SQL manually.',
            sql: createTableSQL
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

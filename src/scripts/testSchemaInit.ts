import dotenv from 'dotenv';

dotenv.config();

import { testConnection } from '../config/database';
import { ensureDatabaseSchema } from '../utils/schemaInitializer';

const testSchemaInit = async () => {
  try {
    console.log('🧪 Testing database connection and schema initialization...');

    // Test connection
    await testConnection();

    // Initialize schema
    await ensureDatabaseSchema();

    console.log('✅ Schema initialization test completed successfully');
  } catch (error) {
    console.error('❌ Schema initialization test failed:', error);
    process.exit(1);
  }
};

testSchemaInit();
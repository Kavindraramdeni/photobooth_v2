const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-service-key-for-offline-tests';

let activeClient = createClient(url, key);

const proxy = {
  from: (...args) => activeClient.from(...args),
  get auth() {
    return activeClient.auth;
  },
  __setClient: (client) => {
    activeClient = client;
  },
};

module.exports = proxy;

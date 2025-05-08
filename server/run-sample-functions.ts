/**
 * This script registers the sample AI agent functions
 * Run with: npx tsx server/run-sample-functions.ts
 */

import { registerSampleFunctions } from './utils/sample-functions';

async function main() {
  try {
    console.log('Starting registration of sample AI agent functions...');
    await registerSampleFunctions();
    console.log('Sample AI agent functions registered successfully');
  } catch (error) {
    console.error('Error registering sample functions:', error);
  }
}

// Run the registration
main().then(() => {
  console.log('Registration process completed');
  process.exit(0);
}).catch(err => {
  console.error('Registration process failed:', err);
  process.exit(1);
});
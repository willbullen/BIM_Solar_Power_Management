import bcrypt from 'bcrypt';

// Hash a password
async function hashPassword(password) {
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  return hash;
}

// Compare passwords
async function comparePasswords(plainText, hashedPassword) {
  const isMatch = await bcrypt.compare(plainText, hashedPassword);
  console.log(`Password: ${plainText}`);
  console.log(`Hash being compared against: ${hashedPassword}`);
  console.log(`Match: ${isMatch}`);
  return isMatch;
}

// Update this to change the test
async function main() {
  // Get the admin stored hash from the database (updated in DB)
  const storedHash = '$2b$10$./W3kCaxtP.Y7fwzjZd5J.Pv3EodIASshrZCkyo/2GdhA5./1SCIu';
  
  // Test admin123 against the new hash
  await comparePasswords('admin123', storedHash);
  
  // Generate hashes for other accounts if needed
  console.log('\nHash for empadmin user with password empadmin123:');
  await hashPassword('empadmin123');
  
  console.log('\nHash for viewer user with password viewer123:');
  await hashPassword('viewer123');
}

main();
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
  // Get the admin stored hash from the database
  const storedHash = '$2b$10$RAGO3IZtg7H/BCrrrAMwF.nckZl0cAzDrfFRM.6iNn.v4DvHXvpgS';
  
  // Test various common passwords
  await comparePasswords('admin123', storedHash);
  await comparePasswords('emporium123', storedHash);
  await comparePasswords('Admin123', storedHash);
  await comparePasswords('password', storedHash);
  await comparePasswords('password123', storedHash);
  await comparePasswords('admin', storedHash);
  await comparePasswords('emporium', storedHash);
  await comparePasswords('Admin', storedHash);
  await comparePasswords('Emporium', storedHash);
  await comparePasswords('Emporium123', storedHash);
  
  // Create a new hash for admin123 (for resetting the password later if needed)
  await hashPassword('admin123');
}

main();
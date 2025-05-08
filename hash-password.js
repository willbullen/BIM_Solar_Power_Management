import bcrypt from 'bcrypt';

async function hashPassword() {
  const password = 'emporium123';
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
}

hashPassword();
import bcrypt from 'bcryptjs';

const password = 'Dizipay@1211';
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error(err);
  } else {
    console.log('HASH:', hash);
  }
});

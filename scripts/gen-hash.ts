import argon2 from 'argon2'

const hash = await argon2.hash('gmpiso9001', {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
})
console.log(hash)

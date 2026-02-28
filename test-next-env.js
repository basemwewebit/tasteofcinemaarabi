const { loadEnvConfig } = require('@next/env')
loadEnvConfig('./')
console.log('HASH:', process.env.ADMIN_PASSWORD_HASH, 'Length:', process.env.ADMIN_PASSWORD_HASH?.length)

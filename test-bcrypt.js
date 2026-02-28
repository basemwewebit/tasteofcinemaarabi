const bcrypt = require('bcryptjs');
const hash = '$2b$12$xrJ3RfMo8v6HkQCKh84jDO9MTDF0SDYytqnjfOPPNHePPWf7O21jq';
console.log('Match?', bcrypt.compareSync('tasteofcinema2026', hash));

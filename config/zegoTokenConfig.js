const zegoTokenGenerator = require("../utils/zego_token_service")

const zegoTokenService = new zegoTokenGenerator(
    process.env.ZEGO_APP_ID,
    process.env.ZEGO_SERVER_SECRET
)
module.exports = zegoTokenService
const crypto = require("crypto")

class zegoTokenGenerator {
    constructor(app_id,server_secret){
        if (!app_id || !server_secret) {
            throw new Error('appID and server secret req')
        }
        this.app_id = app_id
        this.server_secret = server_secret
    }

    generateBasicToken(userId,roomId,privilege = {1:1}){
        const payload = {
            app_id:this.app_id,
            user_id : userId.toString(),
            room_id : roomId,
            privilege : privilege,
            expire_ts: Math.floor(Date.now() / 1000) + 3600
        }
        const payloadStr = JSON.stringify(payload);
        const hash = crypto.createHmac('sha256',this.server_secret).update(payloadStr).digest("hex")

        return `${hash}${Buffer.from(payloadStr).toString('base64')}`;
    }
    async generateServerToken(userId,roomId,privilege = {1:1}){
        const payload = {
            app_id:this.app_id,
            user_id : userId.toString(),
            room_id : roomId,
            privilege : privilege,
            expire_ts: Math.floor(Date.now() / 1000) + 3600
        }
        try {
      const response = await fetch('https://rtc-api.zego.im/v1/rtc-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.serverSecret}`
        },
        body: JSON.stringify(payload)
      });
      console.log(response)

      if (!response.ok) {
        throw new Error(`Zego API responded with status ${response.status}`);
      }

      const data = await response.json();
      return data.data.token;
    } catch (error) {
      console.error('Zego token generation failed:', error.message);
      throw new Error('Failed to generate Zego token');
    }
  }
  verifyToken(token) {
    try {
      const hash = token.substring(0, 64);
      const payloadBase64 = token.substring(64);
      const payloadStr = Buffer.from(payloadBase64, 'base64').toString();
      const expectedHash = crypto.createHmac('sha256', this.serverSecret)
                               .update(payloadStr)
                               .digest('hex');
      
      if (hash !== expectedHash) {
        return false;
      }

      const payload = JSON.parse(payloadStr);
      return payload.expire_ts > Math.floor(Date.now() / 1000);
    } catch (error) {
      return false;
    }
  }
  async verifyServerToken(token) {
  try {
    const response = await fetch('https://rtc-api.zego.im/v1/rtc-token/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.serverSecret}`
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.data.is_valid;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}
}



module.exports = zegoTokenGenerator

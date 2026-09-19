// First-party operational metrics only. Never store account IDs or calendar data.
export async function recordWorkspaceUsage(user, env, now = Date.now()) {
 if (!user.verified || !env.TOKEN_ENCRYPTION_KEY || !Number.isFinite(user.authTime)) return;
 const bytes = new TextEncoder();
 const key = await crypto.subtle.importKey('raw', bytes.encode(env.TOKEN_ENCRYPTION_KEY), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
 const digest = async value => [...new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const day = new Date(now).toISOString().slice(0,10);
 const userKey = await digest('analytics:user:'+user.uid);
 const sessionKey = await digest('analytics:session:'+user.uid+':'+user.authTime);
 const provider = ['password','google.com','microsoft.com'].includes(user.provider) ? user.provider : 'other';
 await env.DB.prepare('INSERT OR IGNORE INTO usage_sessions(day,user_key,session_key,provider) VALUES(?,?,?,?)').bind(day,userKey,sessionKey,provider).run();
}

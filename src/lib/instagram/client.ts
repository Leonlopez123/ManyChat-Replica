// Offizielle Instagram API mit Instagram Login (graph.instagram.com). Keine anderen Endpunkte.

export type IgButton =
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string };

export type IgMessage =
  | { text: string }
  | { attachment: { type: 'template'; payload: { template_type: 'button'; text: string; buttons: IgButton[] } } };

export interface IgProfile {
  username?: string;
  name?: string;
  is_user_follow_business?: boolean;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

export interface InstagramClient {
  replyToComment(commentId: string, text: string): Promise<{ id: string }>;
  privateReply(commentId: string, message: IgMessage): Promise<{ recipient_id?: string; message_id?: string }>;
  sendMessage(igsid: string, message: IgMessage): Promise<{ message_id?: string }>;
  getProfile(igsid: string): Promise<IgProfile>;
  getMedia(mediaId: string): Promise<IgMedia>;
  listMedia(limit?: number): Promise<IgMedia[]>;
}

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number, readonly subcode?: number) {
    super(message);
  }
  get rateLimited() {
    return [4, 17, 32, 613, 80002].includes(this.code ?? -1) || this.status === 429;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function graphFetch<T>(
  url: string,
  init: RequestInit & { token?: string } = {},
  retries = 3,
): Promise<T> {
  const { token, ...rest } = init;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...rest,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.body && typeof rest.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...rest.headers,
      },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number } };
    if (res.ok && !json.error) return json as T;
    const err = new GraphError(json.error?.message ?? `HTTP ${res.status}`, res.status, json.error?.code, json.error?.error_subcode);
    if (err.rateLimited && attempt < retries) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw err;
  }
}

export function createInstagramClient(opts: { token: string; igUserId: string; graphVersion: string }): InstagramClient {
  const base = `https://graph.instagram.com/${opts.graphVersion}`;
  const call = <T>(method: 'GET' | 'POST', p: string, body?: unknown) =>
    graphFetch<T>(`${base}${p}`, { method, token: opts.token, body: body ? JSON.stringify(body) : undefined });

  return {
    replyToComment: (commentId, text) => call('POST', `/${commentId}/replies`, { message: text }),
    privateReply: (commentId, message) =>
      call('POST', `/${opts.igUserId}/messages`, { recipient: { comment_id: commentId }, message }),
    sendMessage: (igsid, message) => call('POST', `/${opts.igUserId}/messages`, { recipient: { id: igsid }, message }),
    getProfile: (igsid) => call('GET', `/${igsid}?fields=username,name,is_user_follow_business`),
    getMedia: (mediaId) => call('GET', `/${mediaId}?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp`),
    listMedia: async (limit = 50) =>
      (
        await call<{ data: IgMedia[] }>(
          'GET',
          `/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp&limit=${limit}`,
        )
      ).data,
  };
}

// ---- Konto verbinden und Token pflegen ----

export const IG_SCOPES = ['instagram_business_basic', 'instagram_business_manage_comments', 'instagram_business_manage_messages'];
export const WEBHOOK_FIELDS = ['comments', 'messages', 'messaging_postbacks'];

export function authorizeUrl(appId: string, redirectUri: string, state: string) {
  const u = new URL('https://www.instagram.com/oauth/authorize');
  u.searchParams.set('client_id', appId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', IG_SCOPES.join(','));
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeCode(appId: string, appSecret: string, redirectUri: string, code: string) {
  const body = new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code });
  const res = await graphFetch<{ access_token?: string; data?: { access_token: string }[] }>(
    'https://api.instagram.com/oauth/access_token',
    { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    0,
  );
  const token = res.access_token ?? res.data?.[0]?.access_token;
  if (!token) throw new Error('Instagram hat keinen Token geliefert');
  return token;
}

export async function toLongLived(appSecret: string, shortToken: string) {
  const u = new URL('https://graph.instagram.com/access_token');
  u.searchParams.set('grant_type', 'ig_exchange_token');
  u.searchParams.set('client_secret', appSecret);
  u.searchParams.set('access_token', shortToken);
  return graphFetch<{ access_token: string; expires_in: number }>(u.toString(), {}, 0);
}

export async function refreshLongLived(token: string) {
  const u = new URL('https://graph.instagram.com/refresh_access_token');
  u.searchParams.set('grant_type', 'ig_refresh_token');
  u.searchParams.set('access_token', token);
  return graphFetch<{ access_token: string; expires_in: number }>(u.toString(), {}, 0);
}

export async function getMe(token: string, graphVersion: string) {
  return graphFetch<{ user_id: string; username: string; account_type?: string }>(
    `https://graph.instagram.com/${graphVersion}/me?fields=user_id,username,account_type`,
    { token },
    0,
  );
}

export async function subscribeWebhooks(token: string, graphVersion: string) {
  return graphFetch<{ success: boolean }>(
    `https://graph.instagram.com/${graphVersion}/me/subscribed_apps?subscribed_fields=${WEBHOOK_FIELDS.join(',')}`,
    { method: 'POST', token },
    0,
  );
}

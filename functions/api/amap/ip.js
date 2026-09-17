// 高德 IP 定位代理：浏览器 -> Pages Function（服务端注入密钥）-> 高德
// 密钥通过 Cloudflare 加密环境变量 AMAP_KEY 注入，永远不会下发到浏览器
export async function onRequestGet({ request, env }) {
  const key = env.AMAP_KEY;
  if (!key) {
    return Response.json(
      { status: "0", infocode: "ERROR", info: "AMAP_KEY 未配置" },
      { status: 500 }
    );
  }

  const api = new URL("https://restapi.amap.com/v3/ip");
  api.searchParams.set("key", key);

  // 用访客真实 IP 定位（CF-Connecting-IP 由 Cloudflare 提供）；高德 ip 参数仅支持 IPv4
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    api.searchParams.set("ip", ip);
  }

  const resp = await fetch(api.toString());
  return Response.json(await resp.json());
}

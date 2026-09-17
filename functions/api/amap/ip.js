// 高德 IP 定位代理：浏览器 -> Pages Function（服务端注入密钥）-> 高德
// 密钥通过 Cloudflare 加密环境变量 AMAP_KEY 注入，永远不会下发到浏览器
const RE_GEO_URL = "https://restapi.amap.com/v3/geocode/regeo";

// 中国大陆大致经纬度范围，境外坐标不送高德反查
function inChina(lon, lat) {
  return lon >= 72 && lon <= 136 && lat >= 17 && lat <= 54;
}

// 用经纬度反查行政区划，返回 { adcode, city, province } 或 null
async function regeoByLngLat(key, lon, lat) {
  const api = new URL(RE_GEO_URL);
  api.searchParams.set("key", key);
  api.searchParams.set("location", `${lon.toFixed(6)},${lat.toFixed(6)}`);
  api.searchParams.set("extensions", "base");
  const data = await (await fetch(api.toString())).json();
  const ac = data && data.regeocode && data.regeocode.addressComponent;
  if (!ac || typeof ac.adcode !== "string" || !/^\d{6}$/.test(ac.adcode)) {
    return null;
  }
  // 直辖市的 city 字段高德返回空数组，此时回退用 province
  const province = typeof ac.province === "string" ? ac.province : "";
  const city = typeof ac.city === "string" && ac.city ? ac.city : province;
  return { adcode: ac.adcode, city, province };
}

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

  const data = await (await fetch(api.toString())).json();

  // 境外 IP / IPv6 出口时高德返回 adcode:[]，用 Cloudflare 自带的经纬度兜底反查
  const adcodeOk = data && typeof data.adcode === "string" && /^\d{6}$/.test(data.adcode);
  if (!adcodeOk) {
    const cf = request.cf || {};
    const lon = Number.parseFloat(cf.longitude);
    const lat = Number.parseFloat(cf.latitude);
    if (Number.isFinite(lon) && Number.isFinite(lat) && inChina(lon, lat)) {
      const hit = await regeoByLngLat(key, lon, lat);
      if (hit) {
        data.adcode = hit.adcode;
        data.city = hit.city;
        data.province = hit.province;
        data.rectangle = `${lon},${lat}`;
        data.fallback = "cfgeo";
      }
    }
  }

  return Response.json(data);
}

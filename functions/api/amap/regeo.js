// 高德逆地理编码代理：浏览器定位得到经纬度 -> Pages Function（服务端注入密钥）-> 高德 -> adcode
// 用于 IP 定位失败（代理出口在境外等）时的前端兜底
export async function onRequestGet({ request, env }) {
  const key = env.AMAP_KEY;
  if (!key) {
    return Response.json(
      { adcode: "", info: "AMAP_KEY 未配置" },
      { status: 500 }
    );
  }

  const u = new URL(request.url);
  const lon = Number.parseFloat(u.searchParams.get("lon") || "");
  const lat = Number.parseFloat(u.searchParams.get("lat") || "");
  // 只接受中国大陆范围内的坐标，避免把境外坐标送进高德
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < 72 ||
    lon > 136 ||
    lat < 17 ||
    lat > 54
  ) {
    return Response.json(
      { adcode: "", info: "坐标超出中国范围" },
      { status: 400 }
    );
  }

  const api = new URL("https://restapi.amap.com/v3/geocode/regeo");
  api.searchParams.set("key", key);
  api.searchParams.set("location", `${lon.toFixed(6)},${lat.toFixed(6)}`);
  api.searchParams.set("extensions", "base");
  api.searchParams.set("radius", "1000");

  const data = await (await fetch(api.toString())).json();
  const ac = data && data.regeocode && data.regeocode.addressComponent;
  const adcode = ac && typeof ac.adcode === "string" ? ac.adcode : "";
  // 直辖市 city 为空数组，回退 province
  const province = ac && typeof ac.province === "string" ? ac.province : "";
  const city =
    ac && typeof ac.city === "string" && ac.city ? ac.city : province;

  return Response.json({ adcode, city, province, infocode: data.infocode || "" });
}

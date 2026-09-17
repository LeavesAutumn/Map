// 高德实时天气代理：城市 adcode 由前端传入，密钥只在服务端使用
export async function onRequestGet({ request, env }) {
  const key = env.AMAP_KEY;
  if (!key) {
    return Response.json(
      { status: "0", infocode: "ERROR", info: "AMAP_KEY 未配置" },
      { status: 500 }
    );
  }

  const city = new URL(request.url).searchParams.get("city") || "";
  if (!/^\d{6}$/.test(city)) {
    return Response.json(
      { status: "0", infocode: "INVALID_PARAM", info: "city 参数无效" },
      { status: 400 }
    );
  }

  const api = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
  api.searchParams.set("key", key);
  api.searchParams.set("city", city);

  const resp = await fetch(api.toString());
  return Response.json(await resp.json());
}

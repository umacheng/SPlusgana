// Render 免費方案 15 分鐘無流量會休眠
// 使用者一進入網頁就靜默 ping 後端，觸發喚醒以減少等待時間
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

if (backendUrl) {
  fetch(`${backendUrl}/health`).catch(() => {})
}

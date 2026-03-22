import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

/**
 * Calls remove.bg API; writes transparent PNG to outputPath.
 * Requires REMOVE_BG_API_KEY in environment.
 */
export async function removeBackground(inputPath, outputPath) {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    throw new Error('REMOVE_BG_API_KEY is not set in environment variables');
  }

  const formData = new FormData();
  formData.append('image_file', fs.createReadStream(inputPath));
  formData.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      ...formData.getHeaders()
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`remove.bg API error (${response.status}): ${errText}`);
  }

  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);
}

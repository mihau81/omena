import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

function getClient(): Anthropic {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

export function isAIEnabled(): boolean {
  return Boolean(apiKey);
}

interface LotMetadata {
  title: string;
  artist: string;
  year?: number | null;
  medium?: string;
  dimensions?: string;
  category?: string | null;
}

/**
 * Generate a Polish lot description from images and metadata.
 * Returns Polish description text.
 */
export async function generateLotDescription(
  imageUrls: string[],
  metadata: LotMetadata,
): Promise<string> {
  const client = getClient();

  const imageContent: Anthropic.ImageBlockParam[] = imageUrls.slice(0, 4).map((url) => ({
    type: 'image',
    source: { type: 'url', url },
  }));

  const metaText = [
    `Tytuł: ${metadata.title}`,
    `Artysta: ${metadata.artist}`,
    metadata.year ? `Rok: ${metadata.year}` : null,
    metadata.medium ? `Technika: ${metadata.medium}` : null,
    metadata.dimensions ? `Wymiary: ${metadata.dimensions}` : null,
    metadata.category ? `Kategoria: ${metadata.category}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Jesteś ekspertem w dziedzinie sztuki i aukcji artystycznych. Napisz profesjonalny opis obiektu aukcyjnego po polsku.

Dane obiektu:
${metaText}

Opis powinien:
- Być napisany po polsku
- Zawierać 2-4 zdania
- Opisywać kompozycję, technikę i nastrój dzieła
- Być profesjonalny i zachęcający dla kolekcjonerów
- NIE zawierać cen ani wycen
- Być zwięzły i precyzyjny

Napisz tylko sam opis, bez dodatkowych komentarzy.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from AI');
  return block.text.trim();
}

/**
 * Translate Polish description to target locale.
 */
export async function translateDescription(
  text: string,
  targetLocale: string,
): Promise<string> {
  const client = getClient();

  const langMap: Record<string, string> = {
    en: 'English',
    de: 'German',
    fr: 'French',
    uk: 'Ukrainian',
    pl: 'Polish',
  };

  const targetLang = langMap[targetLocale] ?? targetLocale;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Translate the following auction lot description to ${targetLang}. Keep the professional tone. Return only the translated text, no additional commentary.\n\n${text}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from AI');
  return block.text.trim();
}

/**
 * Suggest estimate range for a lot based on artist's sold lots.
 */
export async function suggestEstimate(
  artistName: string,
  soldLots: Array<{ title: string; year?: number | null; hammerPrice: number }>,
): Promise<{ min: number; max: number; reasoning: string }> {
  const client = getClient();

  const lotsText = soldLots
    .slice(0, 10)
    .map((l) => `- ${l.title}${l.year ? ` (${l.year})` : ''}: ${l.hammerPrice} PLN`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Based on the following sold lots by ${artistName}, suggest an estimate range (min and max in PLN) for a new lot.

Sold lots:
${lotsText || 'No previous sales data available.'}

Respond with JSON only in this format:
{"min": <number>, "max": <number>, "reasoning": "<brief explanation in Polish>"}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from AI');

  try {
    const parsed = JSON.parse(block.text.trim());
    return {
      min: Math.round(parsed.min / 100) * 100,
      max: Math.round(parsed.max / 100) * 100,
      reasoning: parsed.reasoning,
    };
  } catch {
    throw new Error('Failed to parse AI estimate response');
  }
}

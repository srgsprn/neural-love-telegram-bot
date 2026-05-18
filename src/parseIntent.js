const ASPECT_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1"];

function detectAspectRatio(text) {
  const explicit = text.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
  if (explicit) {
    const ratio = `${explicit[1]}:${explicit[2]}`;
    if (ASPECT_RATIOS.includes(ratio)) return ratio;
  }
  if (/9:16|вертикал|портрет|сторис/i.test(text)) return "9:16";
  if (/4:3/i.test(text)) return "4:3";
  if (/3:4/i.test(text)) return "3:4";
  if (/1:1|квадрат/i.test(text)) return "1:1";
  if (/16:9|горизонт|широк/i.test(text)) return "16:9";
  return null;
}

/**
 * Maps free-text instructions (RU/EN) to neural.love images/process parameters.
 * image_uncrop cannot be combined with other transforms (API limitation).
 */
export function parseProcessingParameters(text) {
  const t = (text || "").trim();
  if (!t) {
    return {
      parameters: { quality_enhance: { multiplier: "4x", noise: false } },
      summary: "улучшение качества (4×)",
    };
  }

  const lower = t.toLowerCase();

  if (
    /uncrop|outpaint|дорисов|расшир(ить|ение)?\s*(кадр|фото|изображ)|дополнить\s*кадр|расширь/i.test(
      lower
    )
  ) {
    const aspect = detectAspectRatio(t);
    if (aspect || /соотношен|aspect|ratio|формат/i.test(lower)) {
      return {
        parameters: {
          image_uncrop: {
            mode: "aspect_ratio",
            aspect_ratio: aspect || "16:9",
          },
        },
        summary: `uncrop → ${aspect || "16:9"}`,
      };
    }
    const iterations = /2\s*(итерац|pass|раз)|twice|дважды/i.test(lower) ? 2 : 1;
    return {
      parameters: {
        image_uncrop: { mode: "outpainting", iterations },
      },
      summary: `дорисовка кадра (${iterations} ит.)`,
    };
  }

  const parameters = {};
  const parts = [];

  if (
    /upscale|апскейл|увелич|4x|×4|x4|quality|качеств|enhance|чётк|четк|резк/i.test(
      lower
    )
  ) {
    parameters.quality_enhance = {
      multiplier: "4x",
      noise: /шум|noise|denoise|убрать\s*шум/i.test(lower),
    };
    parts.push("улучшение 4×");
  }

  if (/sharpen|резкост|размыт|unblur|чётче|четче/i.test(lower)) {
    parameters.image_sharpen = {
      aggressive: /сильн|aggressive|максим/i.test(lower),
    };
    parts.push("резкость");
  }

  if (/coloriz|раскрас|колориз|чёрно-бел|черно-бел|чб\s*→|сделай\s*цветн/i.test(lower)) {
    parameters.image_colorization = {};
    parts.push("колоризация");
  }

  if (/facial|лиц[оа]|портрет.*восстан|восстан.*лиц/i.test(lower)) {
    parameters.image_facial_restoration = {};
    parts.push("восстановление лица");
  }

  if (/old\s*photo|стар(ое|ую|ые)\s*фото|винтаж|архивн|ретро\s*фото/i.test(lower)) {
    parameters.old_photo_restoration = {
      remove_scratches: !/без\s*царапин|не\s*убирай\s*царапин/i.test(lower),
      fix_colors: /цвет|color/i.test(lower),
    };
    parts.push("реставрация старого фото");
  }

  if (Object.keys(parameters).length === 0) {
    parameters.quality_enhance = { multiplier: "4x", noise: false };
    parts.push("улучшение 4× (по умолчанию)");
  }

  return {
    parameters,
    summary: parts.join(" + "),
  };
}

export function welcomeText() {
  return "Пливет и здраствуй 🐭\n\nОтправь фото с подписью или фото, затем текст с задачей.";
}

export function helpText() {
  return welcomeText();
}
